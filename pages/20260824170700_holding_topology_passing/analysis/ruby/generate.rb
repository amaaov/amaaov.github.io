require "csv"
require "fileutils"
require_relative "passing_schedule"
require_relative "passing_four_hand"
require_relative "passing_occupancy"
require_relative "passing_fixtures"

module PassingAnalysis
  module Generate
    module_function

    COLUMNS = %w[
      scenario notation grammar hand_period cycle_length_beats notation_period_beats object_count
      hand_count beat_seconds dwell_ratio p_alpha p_polymorphy p_kappa occupancy_shares mean_q
      pass_count self_count body_occupancy_shares
    ].freeze

    def rows
      FIXTURES.map do |fixture|
        schedule = schedule_for(fixture)
        occupancy = Occupancy.shares(schedule, dwell_ratio: DWELL_RATIO)
        bodies = Occupancy.body_shares(schedule, dwell_ratio: DWELL_RATIO)
        shares = occupancy.fetch(:occupancy_shares)
        mean_q = shares.each_with_index.sum(0.to_r) { |share, held| share * held }
        {
          scenario: fixture.fetch(:name),
          notation: fixture.fetch(:notation),
          grammar: fixture.fetch(:grammar),
          hand_period: schedule.hand_period.to_s,
          cycle_length_beats: schedule.cycle_length,
          notation_period_beats: schedule.period,
          object_count: schedule.ball_count,
          hand_count: schedule.hand_count,
          beat_seconds: format_rational(BEAT_SECONDS),
          dwell_ratio: format_rational(DWELL_RATIO),
          p_alpha: format_rational(occupancy.fetch(:p_alpha)),
          p_polymorphy: format_rational(occupancy.fetch(:p_polymorphy)),
          p_kappa: format_rational(occupancy.fetch(:p_kappa)),
          occupancy_shares: format_shares(shares),
          mean_q: format_rational(mean_q),
          pass_count: schedule.cycle_tosses.count(&:pass),
          self_count: schedule.cycle_tosses.count { |event| event.kind != "empty" && !event.pass },
          body_occupancy_shares: bodies.map { |body| format_shares(body) }.join(" | ")
        }
      end
    end

    def schedule_for(fixture)
      if fixture.fetch(:grammar) == "4hs"
        FourHand.schedule(fixture.fetch(:notation))
      else
        Scheduler.schedule(fixture.fetch(:notation))
      end
    end

    def format_rational(value)
      rational = Rational(value)
      "#{rational.numerator}/#{rational.denominator}"
    end

    def format_shares(shares)
      shares.map { |share| format_rational(share) }.join(" ")
    end

    def write_csv(path)
      FileUtils.mkdir_p(File.dirname(path))
      CSV.open(path, "w") do |csv|
        csv << COLUMNS
        rows.each { |row| csv << COLUMNS.map { |column| row.fetch(column.to_sym) } }
      end
    end
  end
end

if $PROGRAM_NAME == __FILE__
  PassingAnalysis::Generate.write_csv(
    File.expand_path("../results/occupancy_ruby.csv", __dir__)
  )
end
