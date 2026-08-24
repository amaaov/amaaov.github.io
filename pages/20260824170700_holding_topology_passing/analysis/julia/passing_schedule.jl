function landing_key(landing)
    return [[copy(slot) for slot in queue] for queue in landing]
end

function rotate_to_starting_hands(cycle_tosses, cycle_length, starting_hands)
    offset = 0
    found = false
    for candidate in 0:(cycle_length - 1)
        packet = filter(event -> event.beat == candidate, cycle_tosses)
        aligned = all(enumerate(starting_hands)) do (body_index, contact)
            body = body_index - 1
            event = findfirst(toss -> toss.from_body == body, packet)
            event !== nothing && packet[event].from_contact == contact
        end
        if aligned
            offset = candidate
            found = true
            break
        end
    end
    found || return cycle_tosses
    rotated = [PassingEvent(
        mod(event.beat - offset, cycle_length), event.height, event.ball, event.from_body,
        event.from_contact, event.from_hand, event.to_body, event.to_contact, event.to_hand,
        event.hold, event.pass, event.socket_index, event.kind,
    ) for event in cycle_tosses]
    return sort(rotated, by=event -> (event.beat, event.from_hand))
end

function toss_from_contact!(
    tokens, landing, available, intro, body, contact, body_count, beat, hold_twos, record,
)
    events = PassingEvent[]
    from_hand = global_contact(body, contact)
    for (socket_index, token) in enumerate(tokens)
        if token.height == 0
            isempty(available[from_hand + 1]) ||
                throw(ArgumentError("prop landing on 0 toss at beat $beat"))
            record && push!(events, PassingEvent(
                beat, 0, nothing, body, contact, from_hand, body, contact, from_hand,
                false, false, socket_index - 1, "empty",
            ))
            continue
        end
        ball = isempty(available[from_hand + 1]) ? (isempty(intro) ? nothing : popfirst!(intro)) :
            popfirst!(available[from_hand + 1])
        ball === nothing && throw(ArgumentError("no prop available at beat $beat"))
        to_body = destination_body(token, body, body_count)
        to_contact = destination_contact(token, contact)
        to_hand = global_contact(to_body, to_contact)
        hold = hold_twos && token.height == 2 && from_hand == to_hand
        record && push!(events, PassingEvent(
            beat, token.height, ball, body, contact, from_hand, to_body, to_contact, to_hand,
            hold, to_body != body, socket_index - 1, hold ? "hold" : "throw",
        ))
        push!(landing[to_hand + 1][token.height], ball)
    end
    return events
end

function schedule_passing(source; hold_twos=true)
    pattern = parse_passing_siteswap(source)
    ball_count = passing_object_count(pattern)
    (ball_count isa Integer && ball_count >= 1) ||
        throw(ArgumentError("passing object count must be a positive integer"))
    highest = maximum(token.height for sequence in pattern.throws for multiplex in sequence for token in multiplex)
    period = length(pattern.throws[1])
    hand_count = pattern.body_count * 2
    depth = max(highest, 1)
    landing = [[Int[] for _ in 1:depth] for _ in 1:hand_count]
    intro = collect(0:(ball_count - 1))
    cycle_tosses = PassingEvent[]
    init_complete = false
    beat = 0
    throw_contacts = copy(pattern.starting_hands)
    start_key = nothing
    cycle_length = 0
    for _ in 1:2000
        available = [isempty(queue) ? Int[] : popfirst!(queue) for queue in landing]
        for queue in landing
            push!(queue, Int[])
        end
        recorded = PassingEvent[]
        for body in 0:(pattern.body_count - 1)
            contact = throw_contacts[body + 1]
            tokens = pattern.throws[body + 1][(beat % period) + 1]
            append!(recorded, toss_from_contact!(
                tokens, landing, available, intro, body, contact, pattern.body_count,
                beat, hold_twos, init_complete,
            ))
        end
        any(!isempty, available) && throw(ArgumentError("prop landing with no toss at beat $beat"))
        append!(cycle_tosses, recorded)
        if init_complete
            if start_key === nothing
                start_key = landing_key(landing)
            elseif beat > 0 && beat % period == 0 && landing_key(landing) == start_key
                while !isempty(cycle_tosses) && last(cycle_tosses).beat == beat
                    pop!(cycle_tosses)
                end
                cycle_length = beat
                break
            end
        elseif isempty(intro) && (beat + 1) % period == 0
            init_complete = true
            beat = -1
        end
        beat += 1
        for body in 1:pattern.body_count
            throw_contacts[body] = 1 - throw_contacts[body]
        end
    end
    cycle_length == 0 && throw(ArgumentError("pattern did not repeat"))
    rotated = rotate_to_starting_hands(cycle_tosses, cycle_length, pattern.starting_hands)
    return PassingSchedule(
        pattern, ball_count, highest, rotated, cycle_length, period, hand_count, pattern.body_count, 2,
    )
end
