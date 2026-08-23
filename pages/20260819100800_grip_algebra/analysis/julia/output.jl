function csv_value(value)
    value === missing && return ""
    text = value isa AbstractVector ? join(value, ";") : string(value)
    if occursin(',', text) || occursin('"', text) || occursin('\n', text)
        return "\"$(replace(text, "\"" => "\"\""))\""
    end
    return text
end

function write_csv(path::AbstractString, rows)
    isempty(rows) && error("cannot infer CSV columns from no rows")
    mkpath(dirname(path))
    columns = propertynames(first(rows))
    open(path, "w") do stream
        println(stream, join(string.(columns), ','))
        for row in rows
            propertynames(row) == columns || error("inconsistent result columns for $path")
            println(stream, join((csv_value(getproperty(row, column)) for column in columns), ','))
        end
    end
    return path
end

function missing_crosscheck(scenario, status)
    return (
        result_class="model consequence", scenario=scenario.name,
        julia_rho_alpha=max(1 - 2 * scenario.dwell_ratio, 0),
        ruby_rho_alpha=missing, absolute_difference=missing, status,
    )
end

function crosscheck_rho(scenarios, ruby_path::AbstractString; tolerance=1e-12)
    isfile(ruby_path) || return [missing_crosscheck(scenario, "ruby-result-missing") for scenario in scenarios]
    header, rows = read_csv_table(ruby_path)
    scenario_column = findfirst(==("scenario"), header)
    rho_column = findfirst(==("p_alpha"), header)
    if scenario_column === nothing || rho_column === nothing
        return [missing_crosscheck(scenario, "ruby-column-missing") for scenario in scenarios]
    end
    ruby_rho = Dict(row[scenario_column] => parse(Float64, row[rho_column]) for row in rows)
    return [begin
        julia_rho = max(1 - 2 * scenario.dwell_ratio, 0)
        if !haskey(ruby_rho, scenario.name)
            missing_crosscheck(scenario, "ruby-scenario-missing")
        else
            ruby_value = ruby_rho[scenario.name]
            difference = abs(julia_rho - ruby_value)
            (
                result_class="model consequence", scenario=scenario.name,
                julia_rho_alpha=julia_rho, ruby_rho_alpha=ruby_value,
                absolute_difference=difference,
                status=difference <= tolerance ? "match" : "mismatch",
            )
        end
    end for scenario in scenarios]
end

const DEFAULT_HUMAN_CONTROLS = [
    :object_count, :hand_count, :object_mass_kg, :throw_height_m, :beat_frequency_hz,
    :dwell_ratio, :phase_fraction, :catch_compliance_m_per_n, :correction_rate_hz,
]

function human_analysis_rows(observations; controls=DEFAULT_HUMAN_CONTROLS)
    if isempty(observations)
        fit = within_person_regression(observations; outcome_name="", controls)
        return [(
            result_class=fit.result_class, status=fit.status, outcome_name="",
            predictor="", coefficient=missing, standard_error=missing,
            observations=0, participants=0, residual_dof=0,
            controls=join(controls, ";"), absorbed_controls="", method=fit.method,
        )]
    end
    outcomes = unique(string(getproperty(row, :outcome_name)) for row in observations)
    rows = NamedTuple[]
    for outcome_name in outcomes
        fit = within_person_regression(observations; outcome_name, controls)
        if fit.status == "ok"
            for index in eachindex(fit.predictors)
                push!(rows, (
                    result_class=fit.result_class, status=fit.status, outcome_name,
                    predictor=string(fit.predictors[index]), coefficient=fit.coefficients[index],
                    standard_error=fit.standard_errors[index], observations=fit.observations,
                    participants=fit.participants, residual_dof=fit.residual_dof,
                    controls=join(controls, ";"),
                    absorbed_controls=join(fit.absorbed_controls, ";"), method=fit.method,
                ))
            end
        else
            push!(rows, (
                result_class=fit.result_class, status=fit.status, outcome_name,
                predictor="", coefficient=missing, standard_error=missing,
                observations=fit.observations, participants=fit.participants,
                residual_dof=fit.residual_dof, controls=join(controls, ";"),
                absorbed_controls=join(fit.absorbed_controls, ";"),
                method=fit.method,
            ))
        end
    end
    return rows
end

function run_analysis(
    scenarios_path::AbstractString,
    results_directory::AbstractString,
    ruby_phase_path::AbstractString,
    human_observations_path::AbstractString,
    ; human_controls=DEFAULT_HUMAN_CONTROLS,
    ruby_formal_path=joinpath(dirname(ruby_phase_path), "formal_derivations_ruby.csv"),
)
    scenarios = read_scenarios(scenarios_path)
    mechanics_rows = mechanics.(scenarios)
    reliability_rows = reliability.(scenarios)
    reliability_benchmark_rows = reliability_benchmarks(reliability_rows)
    base_scenario = first(scenarios)
    matched_flight_rows = matched_flight_sweep(base_scenario)
    tempo_dwell_rows = tempo_dwell_sweep(base_scenario)
    noise_ablation_rows = noise_ablation_sweep(base_scenario)
    dimensionless_collapse_rows = dimensionless_collapse_sweep(base_scenario)
    formal_rows = formal_derivation_rows()
    formal_crosscheck_rows = formal_derivation_crosscheck_rows(formal_rows, ruby_formal_path)
    viability_rows = viability_summaries(include_refinement=true)
    viability_diagnostic_rows = viability_diagnostics()
    crosscheck_rows = crosscheck_rho(scenarios, ruby_phase_path)
    write_csv(joinpath(results_directory, "mechanics.csv"), mechanics_rows)
    write_csv(joinpath(results_directory, "reliability.csv"), reliability_rows)
    write_csv(
        joinpath(results_directory, "reliability_benchmarks.csv"),
        reliability_benchmark_rows,
    )
    write_csv(joinpath(results_directory, "matched_flight.csv"), matched_flight_rows)
    write_csv(joinpath(results_directory, "tempo_dwell.csv"), tempo_dwell_rows)
    write_csv(joinpath(results_directory, "noise_ablations.csv"), noise_ablation_rows)
    write_csv(
        joinpath(results_directory, "dimensionless_collapse.csv"),
        dimensionless_collapse_rows,
    )
    write_csv(joinpath(results_directory, "formal_derivations_julia.csv"), formal_rows)
    write_csv(
        joinpath(results_directory, "formal_derivation_crosscheck.csv"),
        formal_crosscheck_rows,
    )
    write_csv(joinpath(results_directory, "viability_summary.csv"), viability_rows)
    write_csv(
        joinpath(results_directory, "viability_diagnostics.csv"),
        viability_diagnostic_rows,
    )
    write_csv(joinpath(results_directory, "crosscheck.csv"), crosscheck_rows)
    human_observations = read_human_observations(human_observations_path)
    human_rows = human_analysis_rows(human_observations; controls=human_controls)
    write_csv(joinpath(results_directory, "human_analysis.csv"), human_rows)
    human_status = isempty(human_observations) ? "not_run_no_human_observations" :
        join(unique(row.status for row in human_rows), ";")
    human_result_class = join(unique(row.result_class for row in human_rows), ";")
    formal_crosscheck_status = join(unique(row.status for row in formal_crosscheck_rows), ";")
    return (
        mechanics_rows=length(mechanics_rows), reliability_rows=length(reliability_rows),
        reliability_benchmark_rows=length(reliability_benchmark_rows),
        matched_flight_rows=length(matched_flight_rows),
        tempo_dwell_rows=length(tempo_dwell_rows),
        noise_ablation_rows=length(noise_ablation_rows),
        dimensionless_collapse_rows=length(dimensionless_collapse_rows),
        formal_rows=length(formal_rows),
        formal_crosscheck_rows=length(formal_crosscheck_rows),
        formal_crosscheck_status,
        viability_rows=length(viability_rows),
        viability_diagnostic_rows=length(viability_diagnostic_rows),
        crosscheck_rows=length(crosscheck_rows),
        human_rows=length(human_rows), human_result_class, human_status,
    )
end
