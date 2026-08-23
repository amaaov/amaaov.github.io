function empty_human_result(
    status, outcome_name, predictors=Symbol[];
    observations=0, participants=0, residual_dof=0, absorbed_controls=Symbol[],
)
    return (
        result_class="empirical unknown", status, outcome_name, predictors, absorbed_controls,
        coefficients=Float64[], standard_errors=Float64[], observations,
        participants, residual_dof,
        method="participant fixed effects by within-person demeaning; constant controls absorbed; homoskedastic OLS SE; no p-values",
    )
end

function within_person_regression(observations; outcome_name, controls=Symbol[])
    rows = [row for row in observations if getproperty(row, :outcome_name) == outcome_name]
    predictors = [:p_alpha, :nu_alpha_hz, controls...]
    isempty(rows) && return empty_human_result(
        "not_run_no_human_observations", outcome_name, predictors,
    )
    participant_names = unique(string(getproperty(row, :participant)) for row in rows)
    outcome = Float64[getproperty(row, :outcome_value) for row in rows]
    design = Matrix{Float64}(undef, length(rows), length(predictors))
    for row_index in eachindex(rows), predictor_index in eachindex(predictors)
        design[row_index, predictor_index] = getproperty(rows[row_index], predictors[predictor_index])
    end
    for participant in participant_names
        indices = findall(row -> string(getproperty(row, :participant)) == participant, rows)
        outcome[indices] .-= mean(outcome[indices])
        for predictor_index in eachindex(predictors)
            design[indices, predictor_index] .-= mean(design[indices, predictor_index])
        end
    end
    absorbed_indices = [
        index for index in 3:length(predictors)
        if maximum(abs, design[:, index]) <= eps(Float64) * length(rows)
    ]
    absorbed_controls = predictors[absorbed_indices]
    included_indices = setdiff(eachindex(predictors), absorbed_indices)
    predictors = predictors[included_indices]
    design = design[:, included_indices]
    model_rank = rank(design)
    model_rank == length(predictors) || return empty_human_result(
        "not_run_singular_within_person_design", outcome_name, predictors;
        observations=length(rows), participants=length(participant_names),
        residual_dof=max(length(rows) - length(participant_names) - length(predictors), 0),
        absorbed_controls,
    )
    residual_dof = length(rows) - length(participant_names) - length(predictors)
    residual_dof > 0 || return empty_human_result(
        "not_run_insufficient_residual_degrees_of_freedom", outcome_name, predictors;
        observations=length(rows), participants=length(participant_names), residual_dof,
        absorbed_controls,
    )
    coefficients = design \ outcome
    residuals = outcome - design * coefficients
    residual_variance = sum(abs2, residuals) / residual_dof
    covariance = residual_variance * inv(design' * design)
    standard_errors = sqrt.(max.(diag(covariance), 0))
    return (
        result_class="empirical estimate", status="ok", outcome_name, predictors,
        absorbed_controls,
        coefficients, standard_errors, observations=length(rows),
        participants=length(participant_names), residual_dof,
        method="participant fixed effects by within-person demeaning; constant controls absorbed; homoskedastic OLS SE; no p-values",
    )
end

function read_human_observations(path::AbstractString)
    header, rows = read_csv_table(path)
    isempty(header) && return NamedTuple[]
    names = Tuple(Symbol.(header))
    string_fields = Set([:participant, :outcome_name])
    observations = NamedTuple[]
    for row in rows
        values = Tuple(
            name in string_fields ? value : parse(Float64, value)
            for (name, value) in zip(names, row)
        )
        push!(observations, NamedTuple{names}(values))
    end
    return observations
end
