require "csv"

module GripAnalysis
  class SiteswapProtocol
    Action = Struct.new(
      :beat, :from_hand, :socket_index, :kind, :object_id, :height, :to_hand,
      keyword_init: true
    )

    METADATA_COLUMNS = %w[
      scenario notation timing_family notation_period_beats protocol_cycle_beats
      object_count hand_count beat_seconds dwell_ratio hold_twos
    ].freeze
    ACTION_KINDS = %w[throw hold empty].freeze

    attr_reader(*METADATA_COLUMNS.map(&:to_sym), :actions)

    def self.load_csv(path)
      CSV.read(path, headers: true).group_by { |row| row.fetch("scenario") }.map do |_name, rows|
        metadata = METADATA_COLUMNS.to_h do |column|
          values = rows.map { |row| row.fetch(column) }.uniq
          raise ArgumentError, "inconsistent #{column}" unless values.length == 1

          [column.to_sym, values.first]
        end
        new(**parse_metadata(metadata), actions: rows.map { |row| parse_action(row) })
      end
    end

    def self.parse_metadata(metadata)
      hold_twos = metadata.fetch(:hold_twos)
      raise ArgumentError, "hold_twos must be true or false" unless %w[true false].include?(hold_twos)

      metadata.merge(
        notation_period_beats: Rational(metadata.fetch(:notation_period_beats)),
        protocol_cycle_beats: Rational(metadata.fetch(:protocol_cycle_beats)),
        object_count: Integer(metadata.fetch(:object_count)),
        hand_count: Integer(metadata.fetch(:hand_count)),
        beat_seconds: Rational(metadata.fetch(:beat_seconds)),
        dwell_ratio: Rational(metadata.fetch(:dwell_ratio)),
        hold_twos: hold_twos == "true"
      )
    end

    def self.parse_action(row)
      kind = row.fetch("action_kind")
      positive = kind != "empty"
      Action.new(
        beat: Rational(row.fetch("event_beat")),
        from_hand: Integer(row.fetch("from_hand")),
        socket_index: Integer(row.fetch("socket_index")),
        kind: kind,
        object_id: positive ? Integer(row.fetch("object_id")) : nil,
        height: Integer(row.fetch("throw_height")),
        to_hand: positive ? Integer(row.fetch("to_hand")) : nil
      )
    end

    def initialize(**attributes)
      @actions = attributes.delete(:actions).map(&:freeze).freeze
      METADATA_COLUMNS.each { |column| instance_variable_set("@#{column}", attributes.fetch(column.to_sym)) }
      validate_conservation!
    end

    def positive_actions
      actions.reject { |action| action.kind == "empty" }
    end

    def throws
      actions.select { |action| action.kind == "throw" }
    end

    def holds
      actions.select { |action| action.kind == "hold" }
    end

    def packets
      actions.group_by(&:beat)
    end

    def flight_beats(action)
      action.kind == "hold" ? 0.to_r : action.height - 2 * dwell_ratio
    end

    def held_intervals_by_object
      Array.new(object_count) do |object_id|
        positive_actions.select { |action| action.object_id == object_id }.map do |action|
          if action.kind == "hold"
            [action.beat, action.height.to_r]
          else
            [action.beat + flight_beats(action), 2 * dwell_ratio]
          end
        end
      end
    end

    def valid_conservation?
      validate_conservation!
      true
    rescue ArgumentError
      false
    end

    private

    def validate_conservation!
      validate_metadata!
      validate_actions!
      validate_object_cycles!
    end

    def validate_metadata!
      positive = object_count.positive? && hand_count.positive? && beat_seconds.positive? &&
        notation_period_beats.positive? && protocol_cycle_beats.positive?
      raise ArgumentError, "protocol dimensions must be positive" unless positive
      raise ArgumentError, "dwell ratio must lie in [0, 1]" unless (0..1).cover?(dwell_ratio)
      raise ArgumentError, "cycle must contain whole notation periods" unless
        (protocol_cycle_beats % notation_period_beats).zero?
    end

    def validate_actions!
      raise ArgumentError, "protocol requires actions" if actions.empty?
      sockets = actions.map { |action| [action.beat, action.from_hand, action.socket_index] }
      raise ArgumentError, "duplicate packet socket" unless sockets.uniq.length == sockets.length
      actions.each do |action|
        raise ArgumentError, "unknown action kind" unless ACTION_KINDS.include?(action.kind)
        raise ArgumentError, "event beat outside cycle" unless (0...protocol_cycle_beats).cover?(action.beat)
        raise ArgumentError, "source hand outside protocol" unless (0...hand_count).cover?(action.from_hand)
        if action.kind == "empty"
          raise ArgumentError, "empty action must have height zero" unless action.height.zero?
          next
        end
        raise ArgumentError, "object outside protocol" unless (0...object_count).cover?(action.object_id)
        raise ArgumentError, "target hand outside protocol" unless (0...hand_count).cover?(action.to_hand)
        raise ArgumentError, "action height must be positive" unless action.height.positive?
        raise ArgumentError, "flight duration must be positive" unless action.kind == "hold" || flight_beats(action).positive?
        valid_hold = hold_twos && action.height == 2 && action.from_hand == action.to_hand
        raise ArgumentError, "invalid hold action" if action.kind == "hold" && !valid_hold
      end
    end

    def validate_object_cycles!
      grouped = positive_actions.group_by(&:object_id)
      raise ArgumentError, "every object needs an action cycle" unless grouped.keys.sort == (0...object_count).to_a
      grouped.each_value do |object_actions|
        ordered = object_actions.sort_by(&:beat)
        ordered.each_with_index do |action, index|
          following = ordered.fetch((index + 1) % ordered.length)
          interval = following.beat - action.beat
          interval += protocol_cycle_beats unless interval.positive?
          raise ArgumentError, "throw height breaks object conservation" unless interval == action.height
          raise ArgumentError, "target hand breaks object continuity" unless action.to_hand == following.from_hand
        end
      end
      height_sum = positive_actions.sum(0) { |action| action.height }
      raise ArgumentError, "height sum disagrees with object count" unless
        height_sum == object_count * protocol_cycle_beats
    end
  end
end
