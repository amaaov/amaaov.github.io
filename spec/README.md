# Specs

Canonical test command:

    bundle exec polyrun

Focused maintainer-script run:

    bundle exec polyrun spec/usr/scripts/article_delivery_spec.rb
    bundle exec rspec spec/usr/scripts/github_user_activity_spec.rb

Article analysis Ruby tests (Minitest under `spec/pages/`):

    bundle exec polyrun --suite analysis parallel-minitest -- bundle exec ruby -I. -rminitest/autorun

## Layout

- `spec/usr/scripts/*_spec.rb` — maintainer script contracts (RSpec; default polyrun suite)
- `spec/pages/<article_id>/*_test.rb` — article analysis contracts (Minitest; `--suite analysis`)
- Implementation for analysis stays under `pages/<article_id>/analysis/ruby/`

## What to test

Executable behavior and user-visible contracts: exit codes, reports written, CLI output, public module APIs.

Do not assert source-file contents or implementation-only details.
