const SITESWAP_MODEL_ASSUMPTION =
    "exact periodic intervals; non-hold flight=(height-2*dwell)*beat; declared hold-2 actions remain retained"
const SITESWAP_EMPIRICAL_STATUS = "untested empirical hypothesis"
const SITESWAP_HYPOTHESES = Dict(
    "3" => "Test whether alpha exposure and bout structure predict correction or error beyond throw labels.",
    "55500" => "Test whether clustered empty beats increase correction demand beyond matched dwell and tempo.",
    "441" => "Test whether throw-height order changes effort despite a matched aggregate retention signature.",
    "531" => "Test whether throw-height order changes effort despite a matched aggregate retention signature.",
    "2[22]" => "Test whether modeled full retention lowers error while increasing persistent hand load.",
    "([44],4)(0,0)([22],2)" => "Test whether three-object release and catch packets raise correlated catch error.",
    "5(2,4)1" => "Test whether hybrid packet switching changes error after controlling for modeled retention.",
)

function split_siteswap_interval(start, duration, period)
    duration == 0 && return Tuple{Rational{Int},Rational{Int}}[]
    duration >= period && return [(0 // 1, period)]
    normalized_start = mod(start, period)
    finish = normalized_start + duration
    finish <= period && return [(normalized_start, finish)]
    return [(normalized_start, period), (0 // 1, finish - period)]
end

function siteswap_held_segments(protocol::SiteswapProtocol)
    period = protocol.protocol_cycle_beats * protocol.beat_seconds
    segments = [Tuple{Rational{Int},Rational{Int}}[] for _ in 1:protocol.object_count]
    for action in protocol.actions
        action.action_kind == "empty" && continue
        if action.action_kind == "hold"
            start = action.event_beat * protocol.beat_seconds
            duration = action.throw_height * protocol.beat_seconds
        else
            start = (action.event_beat + siteswap_flight_beats(protocol, action)) *
                protocol.beat_seconds
            duration = 2 * protocol.dwell_ratio * protocol.beat_seconds
        end
        append!(segments[something(action.object_id) + 1],
                split_siteswap_interval(start, duration, period))
    end
    return segments
end

function siteswap_occupancy_segments(protocol::SiteswapProtocol)
    period = protocol.protocol_cycle_beats * protocol.beat_seconds
    held_segments = siteswap_held_segments(protocol)
    boundaries = Rational{Int}[0 // 1, period]
    for object_segments in held_segments, (start, finish) in object_segments
        push!(boundaries, start, finish)
    end
    sort!(unique!(boundaries))
    return [begin
        midpoint = (start + finish) / 2
        held_count = count(object_segments -> any(
            segment_start <= midpoint < segment_finish
            for (segment_start, segment_finish) in object_segments
        ), held_segments)
        (start=start, finish=finish, duration=finish - start, held_count=held_count)
    end for (start, finish) in zip(boundaries[1:end-1], boundaries[2:end])]
end

function alpha_bout_lengths(segments, period)
    all(segment.held_count == 0 for segment in segments) && return [period]
    bouts = Rational{Int}[]
    current = 0 // 1
    for segment in segments
        if segment.held_count == 0
            current += segment.duration
        elseif current > 0
            push!(bouts, current)
            current = 0 // 1
        end
    end
    current > 0 && push!(bouts, current)
    if !isempty(bouts) && first(segments).held_count == 0 && last(segments).held_count == 0
        bouts[1] += pop!(bouts)
    end
    sort!(bouts)
    return bouts
end

function packet_sizes(actions, key)
    packets = Dict{Rational{Int},Int}()
    for action in actions
        packet_key = key(action)
        packets[packet_key] = get(packets, packet_key, 0) + 1
    end
    return collect(values(packets))
end

maximum_packet_size(sizes) = isempty(sizes) ? 0 : maximum(sizes)

function siteswap_hypothesis_row(protocol::SiteswapProtocol)
    segments = siteswap_occupancy_segments(protocol)
    period = protocol.protocol_cycle_beats * protocol.beat_seconds
    occupancy = fill(0 // 1, protocol.object_count + 1)
    for segment in segments
        occupancy[segment.held_count + 1] += segment.duration / period
    end
    positive_actions = filter(action -> action.action_kind != "empty", protocol.actions)
    throws = filter(action -> action.action_kind == "throw", protocol.actions)
    holds = filter(action -> action.action_kind == "hold", protocol.actions)
    action_packets = packet_sizes(positive_actions, action -> action.event_beat)
    release_packets = packet_sizes(throws, action -> action.event_beat)
    capture_packets = packet_sizes(throws, action -> mod(
        action.event_beat + siteswap_flight_beats(protocol, action),
        protocol.protocol_cycle_beats,
    ))
    scheduled_beats = unique(action.event_beat for action in protocol.actions)
    empty_packet_count = count(beat -> all(
        action.action_kind == "empty" for action in protocol.actions
        if action.event_beat == beat
    ), scheduled_beats)
    release_concentration = isempty(throws) ? 0 // 1 :
        sum(size * (size - 1) for size in release_packets) // length(throws)
    mean_retention = sum(occupancy[index + 1] * index
                         for index in 0:protocol.object_count) / protocol.object_count
    airborne_pairs = sum(begin
        held_count = occupancy_index - 1
        airborne_count = protocol.object_count - held_count
        share * airborne_count * (airborne_count - 1) // 2
    end for (occupancy_index, share) in enumerate(occupancy))
    bouts = alpha_bout_lengths(segments, period)
    alpha_entry_count = bouts == [period] ? 0 : length(bouts)
    alpha_mean = isempty(bouts) ? 0 // 1 : sum(bouts) / length(bouts)
    return (
        scenario=protocol.scenario, notation=protocol.notation,
        timing_family=protocol.timing_family, object_count=protocol.object_count,
        hand_count=protocol.hand_count,
        notation_period_beats=protocol.notation_period_beats,
        protocol_cycle_beats=protocol.protocol_cycle_beats,
        beat_seconds=protocol.beat_seconds, dwell_ratio=protocol.dwell_ratio,
        hold_twos=protocol.hold_twos, period_seconds=period,
        scheduled_packet_count=length(scheduled_beats),
        active_packet_count=length(action_packets), empty_packet_count,
        throw_action_count=length(throws), hold_action_count=length(holds),
        release_packet_count=length(release_packets),
        capture_packet_count=length(capture_packets),
        max_action_packet=maximum_packet_size(action_packets),
        max_release_packet=maximum_packet_size(release_packets),
        max_capture_packet=maximum_packet_size(capture_packets), release_concentration,
        occupancy_shares=occupancy, p_alpha=first(occupancy),
        p_amphoteron=sum(occupancy[2:end-1]; init=0 // 1), p_kappa=last(occupancy),
        mean_normalized_retention=mean_retention, airborne_pair_exposure=airborne_pairs,
        alpha_entry_count, alpha_entry_rate_hz=alpha_entry_count / period,
        alpha_bout_count=length(bouts), alpha_bout_lengths_seconds=bouts,
        alpha_mean_bout_seconds=alpha_mean,
        alpha_maximum_bout_seconds=isempty(bouts) ? 0 // 1 : maximum(bouts),
        model_assumption=SITESWAP_MODEL_ASSUMPTION,
        comparison_hypothesis=SITESWAP_HYPOTHESES[protocol.notation],
        empirical_status=SITESWAP_EMPIRICAL_STATUS, result_class="model consequence",
    )
end

siteswap_hypothesis_rows(protocols) = siteswap_hypothesis_row.(protocols)
