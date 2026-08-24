const FOUR_HAND_CYCLE = [1, 3, 0, 2]
const FOUR_HAND_PERIOD = 4

function four_hand_throw_height(character)
    if '0' <= character <= '9'
        return Int(character - '0')
    end
    if 'a' <= character <= 'z'
        return 10 + Int(character - 'a')
    end
    throw(ArgumentError("unsupported four-hand throw: $character"))
end

function parse_four_hand(source)
    text = strip(string(source))
    isempty(text) && throw(ArgumentError("empty four-hand siteswap"))
    occursin("<", text) && throw(ArgumentError("four-hand siteswap is a digit string, not JL passing"))
    heights = [four_hand_throw_height(character) for character in text]
    isempty(heights) && throw(ArgumentError("four-hand pattern has no throws"))
    sum(heights) % length(heights) == 0 ||
        throw(ArgumentError("four-hand object count must be a positive integer"))
    return heights
end

function four_hand_toss!(height, landing, available, intro, from_hand, beat, hold_fours, record)
    from_body = from_hand ÷ 2
    from_contact = from_hand % 2
    if height == 0
        isempty(available[from_hand + 1]) ||
            throw(ArgumentError("prop landing on 0 toss at beat $beat"))
        record || return PassingEvent[]
        return [PassingEvent(
            beat, 0, nothing, from_body, from_contact, from_hand, from_body, from_contact, from_hand,
            false, false, 0, "empty",
        )]
    end
    ball = isempty(available[from_hand + 1]) ? (isempty(intro) ? nothing : popfirst!(intro)) :
        popfirst!(available[from_hand + 1])
    ball === nothing && throw(ArgumentError("no prop available at beat $beat"))
    to_hand = FOUR_HAND_CYCLE[((beat + height) % FOUR_HAND_PERIOD) + 1]
    to_body = to_hand ÷ 2
    to_contact = to_hand % 2
    hold = hold_fours && height == 4 && from_hand == to_hand
    push!(landing[to_hand + 1][height], ball)
    record || return PassingEvent[]
    return [PassingEvent(
        beat, height, ball, from_body, from_contact, from_hand, to_body, to_contact, to_hand,
        hold, to_body != from_body, 0, hold ? "hold" : "throw",
    )]
end

function schedule_four_hand(source; hold_fours=true)
    heights = parse_four_hand(source)
    period = length(heights)
    ball_count = sum(heights) ÷ period
    (ball_count isa Integer && ball_count >= 1) ||
        throw(ArgumentError("four-hand object count must be a positive integer"))
    highest = maximum(heights)
    depth = max(highest, 1)
    landing = [[Int[] for _ in 1:depth] for _ in 1:4]
    intro = collect(0:(ball_count - 1))
    cycle_tosses = PassingEvent[]
    init_complete = false
    beat = 0
    start_key = nothing
    cycle_length = 0
    for _ in 1:4000
        available = [isempty(queue) ? Int[] : popfirst!(queue) for queue in landing]
        for queue in landing
            push!(queue, Int[])
        end
        from_hand = FOUR_HAND_CYCLE[(beat % FOUR_HAND_PERIOD) + 1]
        recorded = four_hand_toss!(
            heights[(beat % period) + 1], landing, available, intro, from_hand, beat, hold_fours, init_complete,
        )
        any(!isempty, available) && throw(ArgumentError("prop landing with no toss at beat $beat"))
        append!(cycle_tosses, recorded)
        if init_complete
            if start_key === nothing
                start_key = landing_key(landing)
            elseif beat > 0 && beat % period == 0 && beat % FOUR_HAND_PERIOD == 0 &&
                    landing_key(landing) == start_key
                while !isempty(cycle_tosses) && last(cycle_tosses).beat == beat
                    pop!(cycle_tosses)
                end
                cycle_length = beat
                break
            end
        elseif isempty(intro) && (beat + 1) % period == 0 && (beat + 1) % FOUR_HAND_PERIOD == 0
            init_complete = true
            beat = -1
        end
        beat += 1
    end
    cycle_length == 0 && throw(ArgumentError("four-hand pattern did not repeat"))
    return PassingSchedule(
        nothing, ball_count, highest, cycle_tosses, cycle_length, period, 4, 2, FOUR_HAND_PERIOD,
    )
end
