# frozen_string_literal: true

require "fileutils"
require "json"
require "minitest/autorun"
require "tmpdir"
require_relative "github_user_activity"

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

# Prefer exact-ish route stubs over the short "api user" login probe.
FAKE_USER = ["api user", { "login" => "amaaov" }].freeze

class GithubUserActivityTest < Minitest::Test
  def setup
    @dir = Dir.mktmpdir
    @db = File.join(@dir, "activity.sqlite")
  end

  def teardown
    FileUtils.remove_entry(@dir)
  end

  def test_upsert_is_idempotent_and_list_filters_by_date
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
    assert_equal 2, GithubUserActivity.upsert_activities(db, rows)
    assert_equal 0, GithubUserActivity.upsert_activities(db, rows)
    filtered = GithubUserActivity.query_activities(
      db, "amaaov",
      since: "2026-02-01T00:00:00Z", until_at: nil, event_type: nil, source: nil, limit: 50
    )
    assert_equal ["event:2"], filtered.map { |row| row["id"] }
    db.close
  end

  def test_sync_skips_covered_range_unless_forced
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
    capture_io do
      assert_equal 0, GithubUserActivity.main(
        ["sync", "--user", "amaaov", "--db", @db,
         "--since", "2026-03-01", "--until", "2026-03-31", "--sources", "events"],
        runner: runner
      )
    end
    first_calls = runner.calls.length
    capture_io do
      assert_equal 0, GithubUserActivity.main(
        ["sync", "--user", "amaaov", "--db", @db,
         "--since", "2026-03-01", "--until", "2026-03-31", "--sources", "events"],
        runner: runner
      )
    end
    assert_equal first_calls, runner.calls.length
    capture_io do
      assert_equal 0, GithubUserActivity.main(
        ["sync", "--user", "amaaov", "--db", @db,
         "--since", "2026-03-01", "--until", "2026-03-31", "--sources", "events", "--force"],
        runner: runner
      )
    end
    assert_operator runner.calls.length, :>, first_calls
  end

  def test_list_reads_only_local_cache_when_data_exists
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
    capture_io do
      assert_equal 0, GithubUserActivity.main(
        ["list", "--user", "amaaov", "--db", @db, "--format", "ndjson"],
        runner: runner
      )
    end
    assert_empty runner.calls
  end

  def test_list_syncs_when_cache_missing
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
    out, err = capture_io do
      assert_equal 0, GithubUserActivity.main(
        ["list", "--user", "amaaov", "--db", @db, "--since", "2026-11-12",
         "--sources", "events", "--format", "ndjson"],
        runner: runner
      )
    end
    assert_match(/syncing amaaov/, err)
    assert_match(/1 row/, err)
    assert_includes out, "event:11"
    assert runner.calls.any? { |args| args.join(" ").include?("events") }
    assert File.file?(@db)
  end

  def test_list_prints_placeholder_when_empty
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
    out, err = capture_io do
      assert_equal 0, GithubUserActivity.main(
        ["list", "--user", "amaaov", "--db", @db, "--since", "2026-11-12",
         "--until", "2026-11-13", "--sources", "events"],
        runner: FakeGh.new([])
      )
    end
    assert_equal "(no activities)\n", out
    assert_match(/0 row\(s\) in 2026-11-12T00:00:00Z \.\. 2026-11-13T23:59:59Z/, err)
  end

  def test_events_keep_in_range_rows_after_older_out_of_order_item
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
    assert_equal 2, added
    assert_equal ["event:1", "event:3"], ids
  end

  def test_list_skips_network_when_range_already_covered
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
    capture_io do
      assert_equal 0, GithubUserActivity.main(
        ["sync", "--user", "amaaov", "--db", @db, "--since", "2026-11-12",
         "--until", "2026-11-13", "--sources", "events"],
        runner: runner
      )
    end
    calls_after_sync = runner.calls.length
    capture_io do
      assert_equal 0, GithubUserActivity.main(
        ["list", "--user", "amaaov", "--db", @db, "--since", "2026-11-12",
         "--until", "2026-11-13", "--sources", "events", "--format", "ndjson"],
        runner: runner
      )
    end
    assert_equal calls_after_sync, runner.calls.length
  end
end
