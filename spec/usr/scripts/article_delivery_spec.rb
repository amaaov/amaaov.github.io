# frozen_string_literal: true

require "check_article_delivery"

RSpec.describe ArticleDelivery do
  around do |example|
    @root = Pathname(Dir.mktmpdir)
    (@root / "page.html").binwrite("12345")
    (@root / "art.svg").binwrite("123")
    @budget = @root / "budget.json"
    @reports = @root / "reports"
    example.run
  ensure
    FileUtils.remove_entry(@root) if @root
  end

  def run_gate(ceiling: 8, paths: nil)
    @budget.write(
      JSON.generate(
        "artifact" => "test-edition",
        "ceiling_bytes" => ceiling,
        "paths" => paths.nil? ? ["page.html", "art.svg"] : paths
      )
    )
    capture_stdio do
      ArticleDelivery.main(["--budget", @budget.to_s, "--reports", @reports.to_s])
    end
  end

  it "stages at the exact ceiling and reports separate metrics" do
    code, = run_gate
    expect(code).to eq(0)
    size = JSON.parse((@reports / "size.json").read)
    timing = JSON.parse((@reports / "build-timing.json").read)
    expect(size["file_bytes"]).to eq(8)
    expect(size["metric"]).to eq("file_bytes")
    expect(timing["metric"]).to eq("static_staging_wall_seconds")
    expect(timing["wall_seconds"]).to be >= 0
    expect(size["run_identity"]).to eq(timing["run_identity"])
    [size, timing].each do |record|
      %w[started_at finished_at repository workflow job step runner_class].each do |field|
        expect(record[field]).to be_truthy
      end
    end
  end

  it "refuses staging over the ceiling" do
    code, = run_gate(ceiling: 7)
    expect(code).to eq(1)
    timing = JSON.parse((@reports / "build-timing.json").read)
    expect(timing["status"]).to eq("skipped-size-gate")
    expect(timing["wall_seconds"]).to be_nil
  end

  it "refuses a missing artifact without writing reports" do
    code, = run_gate(paths: ["missing.html"])
    expect(code).to eq(2)
    expect(@reports).not_to exist
  end

  it "refuses a path outside the checkout" do
    code, = run_gate(paths: ["../outside.html"])
    expect(code).to eq(2)
  end

  it "refuses a duplicate artifact path" do
    code, = run_gate(paths: ["page.html", "page.html"])
    expect(code).to eq(2)
  end

  it "refuses an invalid budget" do
    code_ceiling, = run_gate(ceiling: -1)
    code_paths, = run_gate(paths: [])
    expect(code_ceiling).to eq(2)
    expect(code_paths).to eq(2)
  end
end
