function fubini_number(object_count::Integer)
    object_count >= 0 || throw(ArgumentError("object count must be nonnegative"))
    values = [1]
    for size in 1:object_count
        push!(
            values,
            sum(binomial(size, block_size) * values[size - block_size + 1] for block_size in 1:size),
        )
    end
    return values[end]
end

function companion_release_count(packet_sizes)
    sizes = collect(Int, packet_sizes)
    all(size >= 0 for size in sizes) || throw(
        ArgumentError("packet sizes must be nonnegative"),
    )
    total = sum(sizes)
    iszero(total) && return 0 // 1
    return sum(size * (size - 1) for size in sizes) // total
end

function interior_state_count(object_count::Integer, buffer_events::Integer)
    object_count >= 0 || throw(ArgumentError("object count must be nonnegative"))
    buffer_events >= 0 || throw(ArgumentError("buffer events must be nonnegative"))
    return sum(
        binomial(object_count, held)
        for held in 0:object_count
        if min(held, object_count - held) > buffer_events;
        init=0,
    )
end

function mixed_cycle_rank(object_count::Integer)
    object_count >= 3 || throw(ArgumentError("connected mixed graph starts at three objects"))
    return (object_count - 2) * 2^(object_count - 1) - 2 * object_count + 3
end

function mixed_cycle_rank_enumerated(object_count::Integer)
    object_count >= 3 || throw(ArgumentError("connected mixed graph starts at three objects"))
    mixed = 1:(2^object_count - 2)
    allowed = Set(mixed)
    edges = 0
    for state in mixed
        for bit in 0:(object_count - 1)
            neighbor = state ⊻ (1 << bit)
            if neighbor in allowed && neighbor > state
                edges += 1
            end
        end
    end
    return edges - length(mixed) + 1
end
