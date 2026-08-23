const SITESWAP_PROTOCOL_COLUMNS = [
    "scenario", "notation", "timing_family", "notation_period_beats",
    "protocol_cycle_beats", "object_count", "hand_count", "beat_seconds",
    "dwell_ratio", "hold_twos", "event_beat", "from_hand", "socket_index",
    "action_kind", "object_id", "throw_height", "to_hand",
]

struct SiteswapAction
    event_beat::Rational{Int}
    from_hand::Int
    socket_index::Int
    action_kind::String
    object_id::Union{Nothing,Int}
    throw_height::Int
    to_hand::Union{Nothing,Int}
end

struct SiteswapProtocol
    scenario::String
    notation::String
    timing_family::String
    notation_period_beats::Rational{Int}
    protocol_cycle_beats::Rational{Int}
    object_count::Int
    hand_count::Int
    beat_seconds::Rational{Int}
    dwell_ratio::Rational{Int}
    hold_twos::Bool
    actions::Vector{SiteswapAction}
end

function unique_fixture_value(rows, column_index, column_name)
    values = unique(row[column_index] for row in rows)
    length(values) == 1 || throw(ArgumentError("inconsistent $column_name"))
    return only(values)
end

function parse_siteswap_action(row)
    action_kind = row[14]
    action_kind in ("throw", "hold", "empty") ||
        throw(ArgumentError("unknown action kind: $action_kind"))
    positive = action_kind != "empty"
    positive && (isempty(row[15]) || isempty(row[17])) &&
        throw(ArgumentError("positive actions require object and target hand"))
    return SiteswapAction(
        parse(Rational{Int}, row[11]), parse(Int, row[12]), parse(Int, row[13]),
        action_kind, positive ? parse(Int, row[15]) : nothing, parse(Int, row[16]),
        positive ? parse(Int, row[17]) : nothing,
    )
end

function parse_siteswap_protocol(rows)
    values = [unique_fixture_value(rows, index, SITESWAP_PROTOCOL_COLUMNS[index])
              for index in 1:10]
    values[10] in ("true", "false") ||
        throw(ArgumentError("hold_twos must be true or false"))
    protocol = SiteswapProtocol(
        values[1], values[2], values[3], parse(Rational{Int}, values[4]),
        parse(Rational{Int}, values[5]), parse(Int, values[6]), parse(Int, values[7]),
        parse(Rational{Int}, values[8]), parse(Rational{Int}, values[9]),
        values[10] == "true", parse_siteswap_action.(rows),
    )
    return validate_siteswap_protocol(protocol)
end

function read_siteswap_protocols(path::AbstractString)
    header, rows = read_csv_table(path)
    header == SITESWAP_PROTOCOL_COLUMNS || error("unexpected siteswap columns in $path")
    isempty(rows) && throw(ArgumentError("siteswap fixture requires actions"))
    scenario_order = String[]
    rows_by_scenario = Dict{String,Vector{Vector{String}}}()
    for row in rows
        scenario = row[1]
        if !haskey(rows_by_scenario, scenario)
            push!(scenario_order, scenario)
            rows_by_scenario[scenario] = Vector{Vector{String}}()
        end
        push!(rows_by_scenario[scenario], row)
    end
    return [parse_siteswap_protocol(rows_by_scenario[scenario]) for scenario in scenario_order]
end

function siteswap_flight_beats(protocol::SiteswapProtocol, action::SiteswapAction)
    return action.action_kind == "hold" ? 0 // 1 :
        action.throw_height - 2 * protocol.dwell_ratio
end

function validate_siteswap_protocol(protocol::SiteswapProtocol)
    protocol.object_count > 0 && protocol.hand_count > 0 &&
        protocol.beat_seconds > 0 && protocol.notation_period_beats > 0 &&
        protocol.protocol_cycle_beats > 0 ||
        throw(ArgumentError("protocol dimensions must be positive"))
    0 <= protocol.dwell_ratio <= 1 ||
        throw(ArgumentError("dwell ratio must lie in [0, 1]"))
    protocol.protocol_cycle_beats % protocol.notation_period_beats == 0 ||
        throw(ArgumentError("cycle must contain whole notation periods"))
    isempty(protocol.actions) && throw(ArgumentError("protocol requires actions"))

    sockets = [(action.event_beat, action.from_hand, action.socket_index)
               for action in protocol.actions]
    length(unique(sockets)) == length(sockets) ||
        throw(ArgumentError("duplicate packet socket"))
    object_actions = [SiteswapAction[] for _ in 1:protocol.object_count]
    for action in protocol.actions
        action.action_kind in ("throw", "hold", "empty") ||
            throw(ArgumentError("unknown action kind: $(action.action_kind)"))
        0 <= action.event_beat < protocol.protocol_cycle_beats ||
            throw(ArgumentError("event beat outside cycle"))
        0 <= action.from_hand < protocol.hand_count ||
            throw(ArgumentError("source hand outside protocol"))
        if action.action_kind == "empty"
            action.throw_height == 0 ||
                throw(ArgumentError("empty action must have height zero"))
            continue
        end
        object_id = something(action.object_id)
        target_hand = something(action.to_hand)
        0 <= object_id < protocol.object_count ||
            throw(ArgumentError("object outside protocol"))
        0 <= target_hand < protocol.hand_count ||
            throw(ArgumentError("target hand outside protocol"))
        action.throw_height > 0 || throw(ArgumentError("action height must be positive"))
        if action.action_kind == "hold"
            protocol.hold_twos && action.throw_height == 2 &&
                action.from_hand == target_hand || throw(ArgumentError("invalid hold action"))
        else
            siteswap_flight_beats(protocol, action) > 0 ||
                throw(ArgumentError("flight duration must be positive"))
        end
        push!(object_actions[object_id + 1], action)
    end
    all(actions -> !isempty(actions), object_actions) ||
        throw(ArgumentError("every object needs an action cycle"))
    for actions in object_actions
        sort!(actions; by=action -> action.event_beat)
        for index in eachindex(actions)
            action = actions[index]
            following = actions[mod1(index + 1, length(actions))]
            interval = following.event_beat - action.event_beat
            interval <= 0 && (interval += protocol.protocol_cycle_beats)
            interval == action.throw_height ||
                throw(ArgumentError("throw height breaks object conservation"))
            action.to_hand == following.from_hand ||
                throw(ArgumentError("target hand breaks object continuity"))
        end
    end
    height_sum = sum(action.throw_height for action in protocol.actions
                     if action.action_kind != "empty")
    height_sum == protocol.object_count * protocol.protocol_cycle_beats ||
        throw(ArgumentError("height sum disagrees with object count"))
    return protocol
end
