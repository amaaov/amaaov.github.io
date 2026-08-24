module PassingAnalysis
  ThrowToken = Struct.new(:height, :crossing, :pass, :pass_target, keyword_init: true)
  Pattern = Struct.new(:body_count, :starting_hands, :throws, keyword_init: true)

  module Notation
    module_function

    def parse(source)
      text = source.to_s.strip
      raise ArgumentError, "empty passing siteswap" if text.empty?

      blocks = []
      index = 0
      while index < text.length
        index = skip_space(text, index)
        break if index >= text.length

        block, index = parse_angle_block(text, index)
        blocks << block
      end
      raise ArgumentError, "empty passing siteswap" if blocks.empty?

      merge_blocks(blocks)
    end

    def object_count(pattern)
      height_sum = pattern.throws.sum do |sequence|
        sequence.sum { |multiplex| multiplex.sum(&:height) }
      end
      height_sum / pattern.throws.first.length
    end

    def skip_space(text, index)
      index += 1 while index < text.length && text[index] =~ /\s/
      index
    end

    def parse_throw(text, index)
      index = skip_space(text, index)
      raise ArgumentError, "unexpected end of passing throw" if index >= text.length

      height = throw_height(text[index])
      index += 1
      crossing = height.odd?
      if text[index] == "x" || text[index] == "X"
        crossing = !crossing
        index += 1
      end
      pass = false
      pass_target = nil
      if text[index] == "p" || text[index] == "P"
        pass = true
        index += 1
        if text[index] =~ /[1-9]/
          digits = +""
          while text[index] =~ /[0-9]/
            digits << text[index]
            index += 1
          end
          pass_target = Integer(digits)
        end
      end
      [ThrowToken.new(height: height, crossing: crossing, pass: pass, pass_target: pass_target), index]
    end

    def throw_height(character)
      return Integer(character) if character =~ /[0-9]/
      return 10 + character.ord - 97 if character =~ /[a-z]/

      raise ArgumentError, "unsupported passing throw: #{character}"
    end

    def parse_multiplex(text, index)
      throws = []
      index += 1
      while index < text.length && text[index] != "]"
        index = skip_space(text, index)
        if text[index] == "/"
          index += 1
          next
        end
        break if text[index] == "]"

        token, index = parse_throw(text, index)
        throws << token
      end
      raise ArgumentError, "unclosed passing multiplex" unless text[index] == "]"
      raise ArgumentError, "empty passing multiplex" if throws.empty?

      [throws, index + 1]
    end

    def parse_section(text)
      throws = []
      starting_hand = nil
      index = 0
      while index < text.length
        index = skip_space(text, index)
        break if index >= text.length

        mark = text[index]
        if %w[R L].include?(mark) && throws.empty? && starting_hand.nil?
          starting_hand = mark == "R" ? 1 : 0
          index += 1
          next
        end
        if mark == "["
          multiplex, index = parse_multiplex(text, index)
          throws << multiplex
          next
        end
        token, index = parse_throw(text, index)
        throws << [token]
      end
      { starting_hand: starting_hand, throws: throws }
    end

    def parse_angle_block(text, index)
      raise ArgumentError, "passing notation expected <" unless text[index] == "<"

      close = text.index(">", index)
      raise ArgumentError, "unclosed passing block" if close.nil?

      inner = text[(index + 1)...close]
      parts = []
      depth = 0
      start = 0
      (0..inner.length).each do |cursor|
        character = inner[cursor]
        depth += 1 if character == "[" || character == "("
        depth -= 1 if character == "]" || character == ")"
        next unless cursor == inner.length || (character == "|" && depth.zero?)

        parts << parse_section(inner[start...cursor])
        start = cursor + 1
      end
      raise ArgumentError, "passing block needs at least two bodies" if parts.length < 2

      [parts, close + 1]
    end

    def merge_blocks(blocks)
      body_count = blocks.first.length
      raise ArgumentError, "passing blocks must keep the same body count" unless
        blocks.all? { |block| block.length == body_count }

      starting_hands = Array.new(body_count, 1)
      throws = Array.new(body_count) { [] }
      blocks.each do |block|
        block.each_with_index do |section, body|
          starting_hands[body] = section.fetch(:starting_hand) unless section.fetch(:starting_hand).nil?
          throws[body].concat(section.fetch(:throws))
        end
      end
      beat_count = throws.first.length
      raise ArgumentError, "each body must contribute the same number of beats" unless
        throws.all? { |sequence| sequence.length == beat_count }
      raise ArgumentError, "passing pattern has no throws" if beat_count.zero?

      Pattern.new(body_count: body_count, starting_hands: starting_hands, throws: throws)
    end
  end
end
