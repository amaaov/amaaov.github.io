# frozen_string_literal: true

require "github_user_activity"

class FakeGh
  def initialize(responses)
    @responses = responses
    @calls = []
  end

  attr_reader :calls

  def call(args)
    @calls << args
    key = args.join(" ")
    match = @responses
      .select { |prefix, _| key.include?(prefix) }
      .max_by { |prefix, _| prefix.length }
    raise "unexpected gh call: #{args.inspect}" if match.nil?

    JSON.parse(JSON.generate(match[1]))
  end
end

RSpec.describe GithubUserActivity do
  around do |example|
    @dir = Dir.mktmpdir
    @db = File.join(@dir, "activity.sqlite")
    example.run
  ensure
    FileUtils.remove_entry(@dir) if @dir
  end

  it "upserts idempotently and lists with a date filter" do
    db = GithubUserActivity.connect(@db)
    rows = [
      GithubUserActivity.activity_row(
        id: "event:1", user: "amaaov", source: "events", event_type: "PushEvent",
        occurred_at: "2026-01-10T12:00:00Z", actor: "amaaov", repo: "amaaov/site",
        title: nil, url: nil, summary: "push", payload: { "id" => 1 }
      ),
      GithubUserActivity.activity_row(
        id: "event:2", user: "amaaov", source: "events", event_type: "WatchEvent",
        occurred_at: "2026-02-01T12:00:00Z", actor: "amaaov", repo: "other/repo",
        title: nil, url: "https://github.com/other/repo", summary: "starred",
        payload: { "id" => 2 }
      )
    ]
    expect(GithubUserActivity.upsert_activities(db, rows)).to eq(2)
    expect(GithubUserActivity.upsert_activities(db, rows)).to eq(0)
    filtered = GithubUserActivity.query_activities(
      db, "amaaov",
      since: "2026-02-01T00:00:00Z", until_at: nil, event_type: nil, source: nil, limit: 50
    )
    expect(filtered.map { |row| row["id"] }).to eq(["event:2"])
    db.close
  end

  it "skips a covered sync range unless forced" do
    events = [{
      "id" => 9,
      "type" => "PushEvent",
      "created_at" => "2026-03-01T10:00:00Z",
      "actor" => { "login" => "amaaov" },
      "repo" => { "name" => "amaaov/site" },
      "payload" => { "commits" => [{ "sha" => "abc" }], "ref" => "refs/heads/main" }
    }]
    runner = FakeGh.new([
      ["api user", { "login" => "amaaov" }],
      ["users/amaaov/events", events]
    ])
    capture_stdio do
      expect(GithubUserActivity.main(
        ["sync", "--user", "amaaov", "--db", @db,
         "--since", "2026-03-01", "--until", "2026-03-31", "--sources", "events"],
        runner: runner
      )).to eq(0)
    end
    first_calls = runner.calls.length
    capture_stdio do
      expect(GithubUserActivity.main(
        ["sync", "--user", "amaaov", "--db", @db,
         "--since", "2026-03-01", "--until", "2026-03-31", "--sources", "events"],
        runner: runner
      )).to eq(0)
    end
    expect(runner.calls.length).to eq(first_calls)
    capture_stdio do
      expect(GithubUserActivity.main(
        ["sync", "--user", "amaaov", "--db", @db,
         "--since", "2026-03-01", "--until", "2026-03-31", "--sources", "events", "--force"],
        runner: runner
      )).to eq(0)
    end
    expect(runner.calls.length).to be > first_calls
  end

  it "lists from the local cache when data exists" do
    db = GithubUserActivity.connect(@db)
    GithubUserActivity.upsert_activities(db, [
      GithubUserActivity.activity_row(
        id: "search:3", user: "amaaov", source: "search", event_type: "Issue",
        occurred_at: "2025-12-01T08:00:00Z", actor: "amaaov", repo: "amaaov/site",
        title: "Hello", url: "https://github.com/amaaov/site/issues/1",
        summary: "open", payload: { "id" => 3 }
      )
    ])
    db.close
    runner = FakeGh.new([])
    capture_stdio do
      expect(GithubUserActivity.main(
        ["list", "--user", "amaaov", "--db", @db, "--format", "ndjson"],
        runner: runner
      )).to eq(0)
    end
    expect(runner.calls).to be_empty
  end

  it "syncs before list when the cache is missing" do
    events = [{
      "id" => 11,
      "type" => "PushEvent",
      "created_at" => "2026-11-12T10:00:00Z",
      "actor" => { "login" => "amaaov" },
      "repo" => { "name" => "amaaov/site" },
      "payload" => { "commits" => [], "ref" => "refs/heads/main" }
    }]
    runner = FakeGh.new([
      ["api user", { "login" => "amaaov" }],
      ["users/amaaov/events", events],
      ["search/issues", { "items" => [] }],
      ["starred", []]
    ])
    _code, out, err = capture_stdio do
      GithubUserActivity.main(
        ["list", "--user", "amaaov", "--db", @db, "--since", "2026-11-12",
         "--sources", "events", "--format", "ndjson"],
        runner: runner
      )
    end
    expect(_code).to eq(0)
    expect(err).to match(/syncing amaaov/)
    expect(err).to match(/1 row/)
    expect(out).to include("event:11")
    expect(runner.calls.any? { |args| args.join(" ").include?("events") }).to be(true)
    expect(File.file?(@db)).to be(true)
  end

  it "prints a placeholder when the filtered range is empty" do
    db = GithubUserActivity.connect(@db)
    GithubUserActivity.upsert_activities(db, [
      GithubUserActivity.activity_row(
        id: "event:old", user: "amaaov", source: "events", event_type: "PushEvent",
        occurred_at: "2020-01-01T00:00:00Z", actor: "amaaov", repo: "amaaov/site",
        title: nil, url: nil, summary: "old", payload: { "id" => 1 }
      )
    ])
    GithubUserActivity.mark_coverage(db, "amaaov", "events", "2026-11-12T00:00:00Z", "2026-11-13T23:59:59Z")
    db.close
    _code, out, err = capture_stdio do
      GithubUserActivity.main(
        ["list", "--user", "amaaov", "--db", @db, "--since", "2026-11-12",
         "--until", "2026-11-13", "--sources", "events"],
        runner: FakeGh.new([])
      )
    end
    expect(_code).to eq(0)
    expect(out).to eq("(no activities)\n")
    expect(err).to match(/0 row\(s\) in 2026-11-12T00:00:00Z \.\. 2026-11-13T23:59:59Z/)
  end

  it "keeps in-range events after an older out-of-order item" do
    events = [
      {
        "id" => 1, "type" => "PushEvent", "created_at" => "2026-11-13T05:00:00Z",
        "actor" => { "login" => "amkisko" }, "repo" => { "name" => "a/b" },
        "payload" => { "commits" => [], "ref" => "refs/heads/main" }
      },
      {
        "id" => 2, "type" => "PushEvent", "created_at" => "2026-11-11T05:00:00Z",
        "actor" => { "login" => "amkisko" }, "repo" => { "name" => "a/old" },
        "payload" => { "commits" => [], "ref" => "refs/heads/main" }
      },
      {
        "id" => 3, "type" => "PullRequestEvent", "created_at" => "2026-11-12T12:00:00Z",
        "actor" => { "login" => "amkisko" }, "repo" => { "name" => "a/pr" },
        "payload" => {
          "action" => "opened",
          "pull_request" => {
            "title" => "Later in page", "html_url" => "https://github.com/a/pr/pull/1"
          }
        }
      }
    ]
    runner = FakeGh.new([["users/amkisko/events", events]])
    db = GithubUserActivity.connect(@db)
    added = GithubUserActivity.sync_events(
      db, "amkisko", "2026-11-12T00:00:00Z", nil, runner: runner
    )
    ids = db.execute(
      "SELECT id FROM activities WHERE user_login=? ORDER BY id", ["amkisko"]
    ).map { |row| row["id"] }
    db.close
    expect(added).to eq(2)
    expect(ids).to eq(["event:1", "event:3"])
  end

  it "skips network on list when the range is already covered" do
    events = [{
      "id" => 12,
      "type" => "WatchEvent",
      "created_at" => "2026-11-12T11:00:00Z",
      "actor" => { "login" => "amaaov" },
      "repo" => { "name" => "other/repo" },
      "payload" => { "action" => "started" }
    }]
    runner = FakeGh.new([
      ["api user", { "login" => "amaaov" }],
      ["users/amaaov/events", events]
    ])
    capture_stdio do
      expect(GithubUserActivity.main(
        ["sync", "--user", "amaaov", "--db", @db, "--since", "2026-11-12",
         "--until", "2026-11-13", "--sources", "events"],
        runner: runner
      )).to eq(0)
    end
    calls_after_sync = runner.calls.length
    capture_stdio do
      expect(GithubUserActivity.main(
        ["list", "--user", "amaaov", "--db", @db, "--since", "2026-11-12",
         "--until", "2026-11-13", "--sources", "events", "--format", "ndjson"],
        runner: runner
      )).to eq(0)
    end
    expect(runner.calls.length).to eq(calls_after_sync)
  end
end
