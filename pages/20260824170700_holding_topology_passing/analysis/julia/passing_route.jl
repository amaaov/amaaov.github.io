function destination_body(token::ThrowToken, source_body, body_count)
    token.pass || return source_body
    if token.pass_target === nothing
        body_count == 2 || throw(ArgumentError("implicit pass needs exactly two bodies"))
        return 1 - source_body
    end
    target = token.pass_target - 1
    0 <= target < body_count || throw(ArgumentError("pass target outside the body set"))
    return target
end

function destination_contact(token::ThrowToken, source_contact)
    return token.crossing ? 1 - source_contact : source_contact
end

function global_contact(body, contact)
    return body * 2 + contact
end
