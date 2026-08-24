function skip_space(text, index)
    while index <= lastindex(text) && isspace(text[index])
        index = nextind(text, index)
    end
    return index
end

function throw_height(character)
    '0' <= character <= '9' && return character - '0'
    'a' <= character <= 'z' && return 10 + (character - 'a')
    throw(ArgumentError("unsupported passing throw: $character"))
end

function parse_passing_throw(text, index)
    index = skip_space(text, index)
    index > lastindex(text) && throw(ArgumentError("unexpected end of passing throw"))
    height = throw_height(text[index])
    index += 1
    crossing = isodd(height)
    if index <= lastindex(text) && (text[index] == 'x' || text[index] == 'X')
        crossing = !crossing
        index += 1
    end
    pass = false
    pass_target = nothing
    if index <= lastindex(text) && (text[index] == 'p' || text[index] == 'P')
        pass = true
        index += 1
        if index <= lastindex(text) && '1' <= text[index] <= '9'
            digits = Char[]
            while index <= lastindex(text) && '0' <= text[index] <= '9'
                push!(digits, text[index])
                index += 1
            end
            pass_target = parse(Int, String(digits))
        end
    end
    return ThrowToken(height, crossing, pass, pass_target), index
end

function parse_multiplex(text, index)
    throws = ThrowToken[]
    index += 1
    while index <= lastindex(text) && text[index] != ']'
        index = skip_space(text, index)
        if text[index] == '/'
            index += 1
            continue
        end
        text[index] == ']' && break
        token, index = parse_passing_throw(text, index)
        push!(throws, token)
    end
    index <= lastindex(text) && text[index] == ']' || throw(ArgumentError("unclosed passing multiplex"))
    isempty(throws) && throw(ArgumentError("empty passing multiplex"))
    return throws, index + 1
end

function parse_section(text)
    throws = Vector{ThrowToken}[]
    starting_hand = nothing
    index = firstindex(text)
    while index <= lastindex(text)
        index = skip_space(text, index)
        index > lastindex(text) && break
        mark = text[index]
        if (mark == 'R' || mark == 'L') && isempty(throws) && starting_hand === nothing
            starting_hand = mark == 'R' ? 1 : 0
            index += 1
            continue
        end
        if mark == '['
            multiplex, index = parse_multiplex(text, index)
            push!(throws, multiplex)
            continue
        end
        token, index = parse_passing_throw(text, index)
        push!(throws, [token])
    end
    return (starting_hand=starting_hand, throws=throws)
end

function parse_angle_block(text, index)
    text[index] == '<' || throw(ArgumentError("passing notation expected <"))
    close = findnext('>', text, index)
    close === nothing && throw(ArgumentError("unclosed passing block"))
    inner = text[(index + 1):(close - 1)]
    parts = NamedTuple[]
    depth = 0
    start = 1
    for cursor in 1:(length(inner) + 1)
        character = cursor <= length(inner) ? inner[cursor] : '\0'
        depth += Int(character == '[' || character == '(')
        depth -= Int(character == ']' || character == ')')
        if cursor == length(inner) + 1 || (character == '|' && depth == 0)
            push!(parts, parse_section(inner[start:(cursor - 1)]))
            start = cursor + 1
        end
    end
    length(parts) < 2 && throw(ArgumentError("passing block needs at least two bodies"))
    return parts, close + 1
end

function merge_blocks(blocks)
    body_count = length(blocks[1])
    all(length(block) == body_count for block in blocks) ||
        throw(ArgumentError("passing blocks must keep the same body count"))
    starting_hands = fill(1, body_count)
    throws = [Vector{ThrowToken}[] for _ in 1:body_count]
    for block in blocks
        for body in 1:body_count
            section = block[body]
            if section.starting_hand !== nothing
                starting_hands[body] = section.starting_hand
            end
            append!(throws[body], section.throws)
        end
    end
    beat_count = length(throws[1])
    all(length(sequence) == beat_count for sequence in throws) ||
        throw(ArgumentError("each body must contribute the same number of beats"))
    beat_count == 0 && throw(ArgumentError("passing pattern has no throws"))
    return PassingPattern(body_count, starting_hands, throws)
end

function parse_passing_siteswap(source)
    text = strip(String(source))
    blocks = Vector{Vector{NamedTuple}}()
    index = firstindex(text)
    while index <= lastindex(text)
        index = skip_space(text, index)
        index > lastindex(text) && break
        block, index = parse_angle_block(text, index)
        push!(blocks, block)
    end
    isempty(blocks) && throw(ArgumentError("empty passing siteswap"))
    return merge_blocks(blocks)
end

function passing_object_count(pattern::PassingPattern)
    height_sum = sum(sum(sum(token.height for token in multiplex) for multiplex in sequence)
                     for sequence in pattern.throws)
    return height_sum ÷ length(pattern.throws[1])
end
