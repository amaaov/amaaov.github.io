const SITESWAP_EXACT_METRICS = [
    :object_count, :hand_count, :notation_period_beats, :protocol_cycle_beats,
    :beat_seconds, :dwell_ratio, :hold_twos, :period_seconds,
    :scheduled_packet_count, :active_packet_count, :empty_packet_count,
    :throw_action_count, :hold_action_count, :release_packet_count,
    :capture_packet_count, :max_action_packet, :max_release_packet,
    :max_capture_packet, :release_concentration, :occupancy_shares, :p_alpha,
    :p_polymorphy, :p_kappa, :mean_normalized_retention,
    :airborne_pair_exposure, :alpha_entry_count, :alpha_entry_rate_hz,
    :alpha_bout_count, :alpha_bout_lengths_seconds, :alpha_mean_bout_seconds,
    :alpha_maximum_bout_seconds,
]
const SITESWAP_INTEGER_METRICS = Set([
    :object_count, :hand_count, :scheduled_packet_count, :active_packet_count,
    :empty_packet_count, :throw_action_count, :hold_action_count,
    :release_packet_count, :capture_packet_count, :max_action_packet,
    :max_release_packet, :max_capture_packet, :alpha_entry_count, :alpha_bout_count,
])

function canonical_exact_value(value, metric)
    if metric in SITESWAP_RATIONAL_COLUMNS
        return siteswap_exact(value)
    elseif metric in SITESWAP_INTEGER_METRICS
        return string(Int(value))
    elseif metric == :hold_twos
        return string(Bool(value))
    end
    error("unknown exact metric: $metric")
end

function canonical_ruby_value(value::AbstractString, metric)
    if metric in SITESWAP_RATIONAL_COLUMNS
        isempty(value) && return ""
        return join((siteswap_fraction(parse(Rational{Int}, entry))
                     for entry in split(value, ';')), ';')
    elseif metric in SITESWAP_INTEGER_METRICS
        return string(parse(Int, value))
    elseif metric == :hold_twos
        value in ("true", "false") || error("invalid Ruby Boolean for $metric")
        return value
    end
    error("unknown exact metric: $metric")
end

function ruby_metric_column(metric)
    return metric in SITESWAP_RATIONAL_COLUMNS ? "$(metric)_exact" : string(metric)
end

function siteswap_crosscheck_rows(julia_rows, ruby_path::AbstractString)
    isfile(ruby_path) || throw(ArgumentError("Ruby siteswap result missing: $ruby_path"))
    header, raw_rows = read_csv_table(ruby_path)
    scenario_column = findfirst(==("scenario"), header)
    scenario_column === nothing && error("Ruby siteswap result lacks scenario")
    metric_columns = Dict(metric => findfirst(==(ruby_metric_column(metric)), header)
                          for metric in SITESWAP_EXACT_METRICS)
    missing_columns = [metric for (metric, column) in metric_columns if column === nothing]
    isempty(missing_columns) || error(
        "Ruby siteswap result lacks exact metrics: $(join(missing_columns, ", "))",
    )
    ruby_by_scenario = Dict{String,Vector{String}}()
    for raw_row in raw_rows
        scenario = raw_row[scenario_column]
        haskey(ruby_by_scenario, scenario) &&
            error("duplicate Ruby siteswap scenario: $scenario")
        ruby_by_scenario[scenario] = raw_row
    end
    return [begin
        mismatches = String[]
        if !haskey(ruby_by_scenario, julia_row.scenario)
            append!(mismatches, string.(SITESWAP_EXACT_METRICS))
            status = "ruby-scenario-missing"
        else
            ruby_row = ruby_by_scenario[julia_row.scenario]
            for metric in SITESWAP_EXACT_METRICS
                julia_value = canonical_exact_value(getproperty(julia_row, metric), metric)
                ruby_value = canonical_ruby_value(ruby_row[metric_columns[metric]], metric)
                julia_value == ruby_value || push!(mismatches, string(metric))
            end
            status = isempty(mismatches) ? "match" : "mismatch"
        end
        (
            result_class="model consequence", scenario=julia_row.scenario,
            notation=julia_row.notation, metrics_compared=length(SITESWAP_EXACT_METRICS),
            matching_metrics=length(SITESWAP_EXACT_METRICS) - length(mismatches),
            mismatch_count=length(mismatches), mismatched_metrics=join(mismatches, ';'),
            status, comparison_scope="all shared deterministic exact metrics",
            empirical_status="not an empirical test",
        )
    end for julia_row in julia_rows]
end

function generate_siteswap_analysis(
    protocols_path::AbstractString,
    results_directory::AbstractString,
    ruby_results_path::AbstractString,
)
    protocols = read_siteswap_protocols(protocols_path)
    rows = siteswap_hypothesis_rows(protocols)
    write_siteswap_hypothesis_csv(
        joinpath(results_directory, "siteswap_hypotheses_julia.csv"), rows,
    )
    comparisons = siteswap_crosscheck_rows(rows, ruby_results_path)
    write_csv(joinpath(results_directory, "siteswap_crosscheck.csv"), comparisons)
    statuses = unique(row.status for row in comparisons)
    return (
        siteswap_rows=length(rows), crosscheck_rows=length(comparisons),
        crosscheck_status=join(statuses, ';'),
    )
end
