require_relative "passing_schedule"

module PassingAnalysis
  module FourHand
    HAND_CYCLE = [1, 3, 0, 2].freeze
    HAND_PERIOD = 4

    module_function

    def schedule(source, hold_fours: true)
      heights = parse(source)
      period = heights.length
      ball_count = heights.sum / period
      raise ArgumentError, "four-hand object count must be a positive integer" unless
        ball_count.is_a?(Integer) && ball_count.positive?

      highest = heights.max
      depth = [highest, 1].max
      landing = Array.new(4) { Array.new(depth) { [] } }
      intro = (0...ball_count).to_a
      cycle_tosses = []
      init_complete = false
      beat = 0
      start_key = nil
      cycle_length = 0

      4000.times do
        available = landing.map(&:shift)
        landing.each { |queue| queue << [] }
        from_hand = HAND_CYCLE.fetch(beat % HAND_PERIOD)
        recorded = toss(
          heights.fetch(beat % period), landing, available, intro, from_hand, beat, hold_fours, init_complete
        )
        raise ArgumentError, "prop landing with no toss at beat #{beat}" if available.any? { |queue| !queue.empty? }

        cycle_tosses.concat(recorded)
        if init_complete
          if start_key.nil?
            start_key = Marshal.dump(landing)
          elsif beat.positive? && (beat % period).zero? && (beat % HAND_PERIOD).zero? &&
              Marshal.dump(landing) == start_key
            cycle_tosses.pop while !cycle_tosses.empty? && cycle_tosses.last.beat == beat
            cycle_length = beat
            break
          end
        elsif intro.empty? && ((beat + 1) % period).zero? && ((beat + 1) % HAND_PERIOD).zero?
          init_complete = true
          beat = -1
        end
        beat += 1
      end
      raise ArgumentError, "four-hand pattern did not repeat" if cycle_length.zero?

      Schedule.new(
        pattern: nil,
        ball_count: ball_count,
        highest: highest,
        cycle_tosses: cycle_tosses,
        cycle_length: cycle_length,
        period: period,
        hand_count: 4,
        body_count: 2,
        hand_period: HAND_PERIOD
      )
    end

    def parse(source)
      text = source.to_s.strip
      raise ArgumentError, "empty four-hand siteswap" if text.empty?
      raise ArgumentError, "four-hand siteswap is a digit string, not JL passing" if text.include?("<")

      heights = text.chars.map { |character| throw_height(character) }
      raise ArgumentError, "four-hand pattern has no throws" if heights.empty?
      raise ArgumentError, "four-hand object count must be a positive integer" unless
        (heights.sum % heights.length).zero?

      heights
    end

    def throw_height(character)
      return Integer(character) if character =~ /[0-9]/
      return 10 + character.ord - 97 if character =~ /[a-z]/

      raise ArgumentError, "unsupported four-hand throw: #{character}"
    end

    def toss(height, landing, available, intro, from_hand, beat, hold_fours, record)
      from_body = from_hand / 2
      from_contact = from_hand % 2
      if height.zero?
        raise ArgumentError, "prop landing on 0 toss at beat #{beat}" unless available.fetch(from_hand).empty?
        return [] unless record

        return [Event.new(
          beat: beat, height: 0, ball: nil, from_body: from_body, from_contact: from_contact,
          from_hand: from_hand, to_body: from_body, to_contact: from_contact, to_hand: from_hand,
          hold: false, pass: false, socket_index: 0, kind: "empty"
        )]
      end

      ball = available.fetch(from_hand).shift || intro.shift
      raise ArgumentError, "no prop available at beat #{beat}" if ball.nil?

      to_hand = HAND_CYCLE.fetch((beat + height) % HAND_PERIOD)
      to_body = to_hand / 2
      to_contact = to_hand % 2
      hold = hold_fours && height == 4 && from_hand == to_hand
      landing.fetch(to_hand).fetch(height - 1) << ball
      return [] unless record

      [Event.new(
        beat: beat, height: height, ball: ball, from_body: from_body, from_contact: from_contact,
        from_hand: from_hand, to_body: to_body, to_contact: to_contact, to_hand: to_hand,
        hold: hold, pass: to_body != from_body, socket_index: 0, kind: hold ? "hold" : "throw"
      )]
    end
  end
end
