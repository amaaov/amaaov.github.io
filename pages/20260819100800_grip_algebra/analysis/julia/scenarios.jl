struct Scenario
    name::String
    protocol_kind::String
    siteswap::String
    object_count::Int
    hand_count::Int
    siteswap_period_beats::Float64
    observation_period_beats::Float64
    phase_fraction::Float64
    object_mass_kg::Float64
    gravity_m_s2::Float64
    beat_seconds::Float64
    dwell_ratio::Float64
    position_noise_m::Float64
    velocity_noise_m_s::Float64
    catch_radius_m::Float64
    trials::Int
    seed::Int
end

function validate_scenario(scenario::Scenario)
    scenario.protocol_kind == "steady_periodic" ||
        throw(ArgumentError("unsupported protocol_kind: $(scenario.protocol_kind)"))
    scenario.siteswap == "3" || throw(ArgumentError("unsupported siteswap: $(scenario.siteswap)"))
    scenario.object_count == 3 || throw(ArgumentError("uniform model requires object_count=3"))
    scenario.hand_count == 2 || throw(ArgumentError("uniform model requires hand_count=2"))
    scenario.siteswap_period_beats == 1 ||
        throw(ArgumentError("siteswap 3 has a one-beat notation period"))
    scenario.observation_period_beats == 3 ||
        throw(ArgumentError("uniform model requires a three-beat observation period"))
    0 <= scenario.phase_fraction < 1 || throw(ArgumentError("phase_fraction must be in [0,1)"))
    scenario.phase_fraction == 0.5 ||
        throw(ArgumentError("rho_alpha formula requires phase_fraction=0.5"))
    scenario.object_mass_kg > 0 || throw(ArgumentError("object_mass_kg must be positive"))
    scenario.gravity_m_s2 > 0 || throw(ArgumentError("gravity_m_s2 must be positive"))
    scenario.beat_seconds > 0 || throw(ArgumentError("beat_seconds must be positive"))
    0 < scenario.dwell_ratio <= 1 || throw(ArgumentError("dwell_ratio must be in (0,1]"))
    scenario.position_noise_m >= 0 || throw(ArgumentError("position_noise_m must be nonnegative"))
    scenario.velocity_noise_m_s >= 0 ||
        throw(ArgumentError("velocity_noise_m_s must be nonnegative"))
    scenario.catch_radius_m > 0 || throw(ArgumentError("catch_radius_m must be positive"))
    scenario.trials > 0 || throw(ArgumentError("trials must be positive"))
    return scenario
end

function split_csv_line(line::AbstractString)
    fields = String[]
    buffer = IOBuffer()
    quoted = false
    index = firstindex(line)
    while index <= lastindex(line)
        character = line[index]
        if character == '"'
            next_index = nextind(line, index)
            if quoted && next_index <= lastindex(line) && line[next_index] == '"'
                write(buffer, '"')
                index = next_index
            else
                quoted = !quoted
            end
        elseif character == ',' && !quoted
            push!(fields, String(take!(buffer)))
        else
            write(buffer, character)
        end
        index = nextind(line, index)
    end
    push!(fields, String(take!(buffer)))
    return fields
end

function read_csv_table(path::AbstractString)
    lines = filter(line -> !isempty(strip(line)), readlines(path))
    isempty(lines) && return String[], Vector{Vector{String}}()
    header = split_csv_line(first(lines))
    rows = [split_csv_line(line) for line in Iterators.drop(lines, 1)]
    all(length(row) == length(header) for row in rows) || error("ragged CSV: $path")
    return header, rows
end

function read_scenarios(path::AbstractString)
    header, rows = read_csv_table(path)
    expected = [
        "name", "protocol_kind", "siteswap", "object_count", "hand_count",
        "siteswap_period_beats", "observation_period_beats", "phase_fraction",
        "object_mass_kg", "gravity_m_s2",
        "beat_seconds", "dwell_ratio", "position_noise_m", "velocity_noise_m_s",
        "catch_radius_m", "trials", "seed",
    ]
    header == expected || error("unexpected scenario columns in $path")
    return [validate_scenario(Scenario(
        row[1], row[2], row[3], parse(Int, row[4]), parse(Int, row[5]),
        parse(Float64, row[6]), parse(Float64, row[7]), parse(Float64, row[8]),
        parse(Float64, row[9]), parse(Float64, row[10]), parse(Float64, row[11]),
        parse(Float64, row[12]), parse(Float64, row[13]), parse(Float64, row[14]),
        parse(Float64, row[15]), parse(Int, row[16]), parse(Int, row[17]),
    )) for row in rows]
end
