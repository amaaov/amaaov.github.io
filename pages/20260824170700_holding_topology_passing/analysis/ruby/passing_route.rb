module PassingAnalysis
  module Route
    module_function

    def destination_body(token, source_body, body_count)
      return source_body unless token.pass
      if token.pass_target.nil?
        raise ArgumentError, "implicit pass needs exactly two bodies" unless body_count == 2

        return 1 - source_body
      end

      target = token.pass_target - 1
      raise ArgumentError, "pass target outside the body set" unless (0...body_count).cover?(target)

      target
    end

    def destination_contact(token, source_contact)
      token.crossing ? 1 - source_contact : source_contact
    end

    def global_contact(body, contact)
      body * 2 + contact
    end
  end
end
