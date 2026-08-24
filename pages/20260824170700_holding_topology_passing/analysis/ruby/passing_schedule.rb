require_relative "passing_notation"
require_relative "passing_route"

module PassingAnalysis
  Event = Struct.new(
    :beat, :height, :ball, :from_body, :from_contact, :from_hand,
    :to_body, :to_contact, :to_hand, :hold, :pass, :socket_index, :kind,
    keyword_init: true
  )
  Schedule = Struct.new(
    :pattern, :ball_count, :highest, :cycle_tosses, :cycle_length, :period, :hand_count, :body_count,
    :hand_period,
    keyword_init: true
  )

  module Scheduler
    module_function

    def schedule(source, hold_twos: true)
      pattern = Notation.parse(source)
      ball_count = Notation.object_count(pattern)
      raise ArgumentError, "passing object count must be a positive integer" unless
        ball_count.is_a?(Integer) && ball_count.positive?

      highest = pattern.throws.flatten.map(&:height).max
      period = pattern.throws.first.length
      hand_count = pattern.body_count * 2
      depth = [highest, 1].max
      landing = Array.new(hand_count) { Array.new(depth) { [] } }
      intro = (0...ball_count).to_a
      cycle_tosses = []
      init_complete = false
      beat = 0
      throw_contacts = pattern.starting_hands.dup
      start_key = nil
      cycle_length = 0

      2000.times do
        available = landing.map(&:shift)
        landing.each { |queue| queue << [] }
        recorded = []
        pattern.body_count.times do |body|
          contact = throw_contacts.fetch(body)
          tokens = pattern.throws.fetch(body).fetch(beat % period)
          recorded.concat(
            toss_from_contact(tokens, landing, available, intro, body, contact, pattern.body_count, beat, hold_twos, init_complete)
          )
        end
        raise ArgumentError, "prop landing with no toss at beat #{beat}" if available.any? { |queue| !queue.empty? }

        cycle_tosses.concat(recorded)
        if init_complete
          if start_key.nil?
            start_key = Marshal.dump(landing)
          elsif beat.positive? && (beat % period).zero? && Marshal.dump(landing) == start_key
            cycle_tosses.pop while !cycle_tosses.empty? && cycle_tosses.last.beat == beat
            cycle_length = beat
            break
          end
        elsif intro.empty? && ((beat + 1) % period).zero?
          init_complete = true
          beat = -1
        end
        beat += 1
        pattern.body_count.times { |body| throw_contacts[body] = 1 - throw_contacts[body] }
      end
      raise ArgumentError, "pattern did not repeat" if cycle_length.zero?

      rotated = rotate_to_starting_hands(cycle_tosses, cycle_length, pattern.starting_hands)
      Schedule.new(
        pattern: pattern,
        ball_count: ball_count,
        highest: highest,
        cycle_tosses: rotated,
        cycle_length: cycle_length,
        period: period,
        hand_count: hand_count,
        body_count: pattern.body_count,
        hand_period: 2
      )
    end

    def toss_from_contact(tokens, landing, available, intro, body, contact, body_count, beat, hold_twos, record)
      events = []
      from_hand = Route.global_contact(body, contact)
      tokens.each_with_index do |token, socket_index|
        if token.height.zero?
          raise ArgumentError, "prop landing on 0 toss at beat #{beat}" unless available.fetch(from_hand).empty?
          if record
            events << Event.new(
              beat: beat, height: 0, ball: nil, from_body: body, from_contact: contact, from_hand: from_hand,
              to_body: body, to_contact: contact, to_hand: from_hand, hold: false, pass: false,
              socket_index: socket_index, kind: "empty"
            )
          end
          next
        end
        ball = available.fetch(from_hand).shift || intro.shift
        raise ArgumentError, "no prop available at beat #{beat}" if ball.nil?

        to_body = Route.destination_body(token, body, body_count)
        to_contact = Route.destination_contact(token, contact)
        to_hand = Route.global_contact(to_body, to_contact)
        hold = hold_twos && token.height == 2 && from_hand == to_hand
        if record
          events << Event.new(
            beat: beat, height: token.height, ball: ball, from_body: body, from_contact: contact, from_hand: from_hand,
            to_body: to_body, to_contact: to_contact, to_hand: to_hand, hold: hold, pass: to_body != body,
            socket_index: socket_index, kind: hold ? "hold" : "throw"
          )
        end
        landing.fetch(to_hand).fetch(token.height - 1) << ball
      end
      events
    end

    def rotate_to_starting_hands(cycle_tosses, cycle_length, starting_hands)
      offset = (0...cycle_length).find do |candidate|
        packet = cycle_tosses.select { |event| event.beat == candidate }
        starting_hands.each_with_index.all? do |contact, body|
          event = packet.find { |toss| toss.from_body == body }
          event && event.from_contact == contact
        end
      end
      return cycle_tosses if offset.nil? || offset.zero?

      cycle_tosses.map do |event|
        event.dup.tap { |copy| copy.beat = (event.beat - offset + cycle_length) % cycle_length }
      end.sort_by { |event| [event.beat, event.from_hand] }
    end
  end
end
