function missing_formal_crosscheck(row, status)
    return (
        derivation=row.derivation, case_id=row.case_id, metric=row.metric,
        ruby_value=missing, julia_value=row.value, absolute_difference=missing,
        comparison_mode=isempty(row.exact_value) ? "numeric" : "exact",
        status, result_class=row.result_class,
    )
end

function formal_derivation_crosscheck_rows(
    julia_rows, ruby_path::AbstractString; tolerance=1e-10,
)
    isfile(ruby_path) || return [
        missing_formal_crosscheck(row, "ruby-result-missing") for row in julia_rows
    ]
    header, raw_rows = read_csv_table(ruby_path)
    required = ["derivation", "case_id", "metric", "value", "exact_value"]
    columns = Dict(name => findfirst(==(name), header) for name in required)
    missing_columns = [name for (name, column) in columns if column === nothing]
    isempty(missing_columns) || error(
        "Ruby formal result lacks columns: $(join(missing_columns, ", "))",
    )
    ruby_by_key = Dict{Tuple{String,String,String},Vector{String}}()
    for raw_row in raw_rows
        key = (
            raw_row[columns["derivation"]], raw_row[columns["case_id"]],
            raw_row[columns["metric"]],
        )
        haskey(ruby_by_key, key) && error("duplicate Ruby formal result: $(join(key, ";"))")
        ruby_by_key[key] = raw_row
    end

    return [begin
        key = (row.derivation, row.case_id, row.metric)
        if !haskey(ruby_by_key, key)
            missing_formal_crosscheck(row, "ruby-case-missing")
        else
            ruby_row = ruby_by_key[key]
            ruby_value = parse(Float64, ruby_row[columns["value"]])
            difference = abs(ruby_value - row.value)
            ruby_exact = ruby_row[columns["exact_value"]]
            exact_mode = !isempty(row.exact_value)
            status = if exact_mode
                ruby_exact == row.exact_value ? "match" : "mismatch"
            else
                difference <= tolerance ? "match" : "mismatch"
            end
            (
                derivation=row.derivation, case_id=row.case_id, metric=row.metric,
                ruby_value, julia_value=row.value, absolute_difference=difference,
                comparison_mode=exact_mode ? "exact" : "numeric", status,
                result_class=row.result_class,
            )
        end
    end for row in julia_rows]
end
