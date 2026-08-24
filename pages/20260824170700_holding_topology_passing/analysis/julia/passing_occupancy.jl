function split_interval(start, duration, period)
    duration == 0 && return Tuple{Rational{Int},Rational{Int}}[]
    duration >= period && return [(0 // 1, period)]
    normalized = mod(start, period)
    finish = normalized + duration
    finish <= period && return [(normalized, finish)]
    return [(normalized, period), (0 // 1, finish - period)]
end

function occupancy_shares(schedule::PassingSchedule; dwell_ratio=DWELL_RATIO)
    period = schedule.cycle_length // 1
    dwell = schedule.hand_period * dwell_ratio
    intervals = Dict{Int,Vector{Tuple{Rational{Int},Rational{Int}}}}()
    for event in schedule.cycle_tosses
        event.kind == "empty" && continue
        event.ball === nothing && continue
        object_intervals = get!(intervals, event.ball, Tuple{Rational{Int},Rational{Int}}[])
        if event.kind == "hold"
            append!(object_intervals, split_interval(event.beat // 1, event.height // 1, period))
        else
            append!(object_intervals, split_interval(event.beat + event.height - dwell, dwell, period))
        end
    end
    objects = sort(collect(keys(intervals)))
    segments = [intervals[object] for object in objects]
    boundaries = Rational{Int}[0 // 1, period]
    for object_segments in segments, (start, finish) in object_segments
        push!(boundaries, start, finish)
    end
    sort!(unique!(boundaries))
    occupancy_ticks = zeros(Rational{Int}, schedule.ball_count + 1)
    for (start, finish) in zip(boundaries[1:end-1], boundaries[2:end])
        held = count(object_segments -> any(
            held_start <= start && finish <= held_finish
            for (held_start, held_finish) in object_segments
        ), segments)
    occupancy_ticks[held + 1] += finish - start
    end
    shares = occupancy_ticks ./ period
    return (
        object_count=schedule.ball_count,
        occupancy_shares=shares,
        p_alpha=first(shares),
        p_amphoteron=sum(shares[2:end-1]; init=0 // 1),
        p_kappa=last(shares),
    )
end

function body_occupancy_shares(schedule::PassingSchedule; dwell_ratio=DWELL_RATIO)
    period = schedule.cycle_length // 1
    dwell = schedule.hand_period * dwell_ratio
    intervals = Dict{Int,Vector{Tuple{Rational{Int},Rational{Int},Int}}}()
    for event in schedule.cycle_tosses
        event.kind == "empty" && continue
        event.ball === nothing && continue
        object_intervals = get!(intervals, event.ball, Tuple{Rational{Int},Rational{Int},Int}[])
        if event.kind == "hold"
            for (start, finish) in split_interval(event.beat // 1, event.height // 1, period)
                push!(object_intervals, (start, finish, event.from_body))
            end
        else
            for (start, finish) in split_interval(event.beat + event.height - dwell, dwell, period)
                push!(object_intervals, (start, finish, event.to_body))
            end
        end
    end
    objects = sort(collect(keys(intervals)))
    segments = [intervals[object] for object in objects]
    boundaries = Rational{Int}[0 // 1, period]
    for object_segments in segments, (start, finish, _body) in object_segments
        push!(boundaries, start, finish)
    end
    sort!(unique!(boundaries))
    body_ticks = [zeros(Rational{Int}, schedule.ball_count + 1) for _ in 1:schedule.body_count]
    for (start, finish) in zip(boundaries[1:end-1], boundaries[2:end])
        held_by_body = zeros(Int, schedule.body_count)
        for object_segments in segments
            match = findfirst(segment -> segment[1] <= start && finish <= segment[2], object_segments)
            if match !== nothing
                held_by_body[object_segments[match][3] + 1] += 1
            end
        end
        for body in 1:schedule.body_count
            body_ticks[body][held_by_body[body] + 1] += finish - start
        end
    end
    return [ticks ./ period for ticks in body_ticks]
end
