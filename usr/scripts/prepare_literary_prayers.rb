#!/usr/bin/env ruby
# frozen_string_literal: true

# Convert local agent guidance into shareable prayer sources.
#
# Strips site-bound names and paths, turns markdown tables into plain lists,
# and removes bold markers. ASCII punctuation for structure.

require "fileutils"
require "pathname"

ROOT = Pathname(__FILE__).expand_path.dirname.join("..", "..").expand_path
AGENTS = ROOT.join(".agents", "skills")
CURSOR = ROOT.join(".cursor", "rules")
PRAYERS = ROOT.join("prayers")

SITE_REPLACEMENTS = [
  [%r{https?://amaaov\.github\.io[^\s)"']*}i, "the published site origin"],
  [%r{amaaov\.github\.io}i, "the published site"],
  [/\bamaaov\b/, "the author"],
  [/pages\.html/, "the articles index page"],
  [/feed\.xml/, "the syndication feed"],
  [/sitemap\.xml/, "the sitemap"],
  [/robots\.txt/, "the robots policy file"],
  [%r{(?:python3|ruby) tmp/word_frequency/analyze\.(?:py|rb)}, "the repository lexical QA entrypoint"],
  [%r{tmp/word_frequency/artifacts/[^\s`]+}, "the lexical QA artifact directory"],
  [%r{tmp/word_frequency(?:/artifacts)?}, "the lexical QA working tree"],
  [%r{tmp/<timestamp_slug>/}, "tmp/<article_id>/"],
  [/pages\/YYYYMMDDHHMMSS_slug/, "articles/<timestamp>_<slug>"],
  [/pages\/\*\.html/, "published article HTML"],
  [%r{pages/}, "the article publish directory/"],
  [%r{\.agents/skills/blog-article/}, "the literary-article skill/"],
  [%r{\.agents/blog-article/}, "the literary-article skill/"],
  [%r{\.\./blog-article/}, "the literary-article skill/"],
  [/`blog-article`/, "`literary-article`"],
  [/blog-article/, "literary-article"],
  [/Music of Objects/, "a prior essay"],
  [/On the Modality of Spinning|Modality of Spinning|\bModality\b/, "a prior essay"],
  [/Люди с приколом|\bLyudi\b/, "a prior essay"],
  [/\bManifesto\b/, "a prior manifesto page"],
  [/\bJuggling\b/, "a prior practice essay"],
  [/STIX Two Text|STIX/, "a prior serif choice"],
  [/Fraunces/, "a prior display serif"],
  [/IBM Plex Mono/, "a prior monospace choice"],
  [/suno_multitrack_example|pray_demo/, "named demo pages"],
].freeze

module PrepareLiteraryPrayers
  module_function

  def strip_bold(text)
    text = text.gsub(/\*\*([^*\n]+)\*\*/, '\1')
    text.gsub(/__([^_\n]+)__/, '\1')
  end

  def ascii_punct(text)
    replacements = {
      "\u2014" => " - ",
      "\u2013" => "-",
      "\u2026" => "...",
      "\u2018" => "'",
      "\u2019" => "'",
      "\u201c" => '"',
      "\u201d" => '"',
      "\u00a0" => " ",
      "\u2192" => "->",
      "\u2260" => "!=",
      "\u00a7" => "section ",
    }
    replacements.each { |src, dst| text = text.gsub(src, dst) }
    text.gsub(/ - +/, " - ")
  end

  def convert_table_block(lines)
    rows = []
    lines.each do |line|
      next if line.match?(/^\|\s*:?-{3,}/)

      cells = line.strip.delete_prefix("|").delete_suffix("|").split("|").map(&:strip)
      rows << cells
    end
    return [] if rows.empty?

    header = rows[0].map(&:downcase)
    body = rows.size > 1 ? rows[1..] : []
    out = []
    if header == %w[refuse prefer] || (header.size == 2 && header[0].include?("refuse") && header[1].include?("prefer"))
      body.each do |cells|
        next if cells.size < 2

        out << "- Refuse: #{cells[0]}"
        out << "  Prefer: #{cells[1]}"
      end
      return out
    end
    if header.size == 2
      left, right = rows[0]
      body.each do |cells|
        next if cells.size < 2

        out << "- #{left}: #{cells[0]}. #{right}: #{cells[1]}."
      end
      return out
    end
    (body.empty? ? rows : body).each do |cells|
      joined = cells.reject(&:empty?).join("; ")
      out << "- #{joined}" unless joined.empty?
    end
    out
  end

  def convert_tables(text)
    lines = text.lines(chomp: true)
    out = []
    i = 0
    while i < lines.length
      if lines[i].lstrip.start_with?("|")
        block = []
        while i < lines.length && lines[i].lstrip.start_with?("|")
          block << lines[i]
          i += 1
        end
        out.concat(convert_table_block(block))
        next
      end
      out << lines[i]
      i += 1
    end
    result = out.join("\n")
    result += "\n" if text.end_with?("\n")
    result
  end

  def apply_site_replacements(text)
    SITE_REPLACEMENTS.each { |pattern, repl| text = text.gsub(pattern, repl) }
    text
  end

  def transform_markdown(text, keep_frontmatter: true)
    front = +""
    body = text
    if keep_frontmatter && text.start_with?("---\n")
      ending = text.index("\n---\n", 4)
      if ending
        front = text[0...(ending + 5)]
        body = text[(ending + 5)..]
        front = ascii_punct(strip_bold(apply_site_replacements(front)))
      end
    end
    body = apply_site_replacements(body)
    body = convert_tables(body)
    body = strip_bold(body)
    body = ascii_punct(body)
    body = body.gsub(/[ \t]{2,}/, " ")
    body = body.gsub(/\n{3,}/, "\n\n")
    front + body
  end

  def write_text(path, text)
    path.dirname.mkpath
    path.write(text, encoding: "UTF-8")
  end

  def skip_copy_path?(path, rel)
    return true if path.basename.to_s == ".DS_Store"
    return true if rel.include?("__pycache__")
    return true if %w[.py .pyc].include?(path.extname)

    false
  end

  def copy_tree_transformed(src, dest, patterns = ["**/*"])
    rels = []
    FileUtils.rm_rf(dest) if dest.exist?
    patterns.each do |pattern|
      src.glob(pattern).each do |path|
        next unless path.file?

        rel = path.relative_path_from(src).to_s
        next if skip_copy_path?(path, rel)

        target = dest.join(rel)
        if %w[.md .mdc].include?(path.extname)
          write_text(target, transform_markdown(path.read(encoding: "UTF-8")))
        else
          target.dirname.mkpath
          FileUtils.cp(path, target, preserve: true)
        end
        rels << rel.tr("\\", "/")
      end
    end
    rels.sort
  end

  def prayspec(name, summary, files, exports)
    files_lit = (["README.md", *files]).map { |f| %("#{f}") }.join(",\n    ")
    export_lines = exports.map do |key, meta|
      parts = [%(type: "#{meta[:type]}"), %(path: "#{meta[:path]}")]
      parts << %(summary: "#{meta[:summary]}") if meta[:summary]
      "    \"#{key}\" => {\n      #{parts.join(",\n      ")}\n    }"
    end
    exports_block = export_lines.join(",\n")
    <<~SPEC
      Package::Specification.new do |spec|
        spec.name = "#{name}"
        spec.summary = "#{summary}"
        spec.files = [
          #{files_lit}
        ]
        spec.exports = {
      #{exports_block}
        }
      end
    SPEC
  end

  def main
    lit = PRAYERS.join("literary-article")
    skill_files = copy_tree_transformed(
      AGENTS.join("blog-article"),
      lit.join("skills", "literary-article"),
    )
    patterns_path = lit.join("skills", "literary-article", "ARTICLE_PATTERNS.md")
    if patterns_path.exist?
      patterns_path.delete
      skill_files = skill_files.reject { |f| f == "ARTICLE_PATTERNS.md" }
      write_text(
        lit.join("skills", "literary-article", "PRECEDENT_STUDY.md"),
        transform_markdown(<<~MD),
          # Precedent study

          Past published essays are precedents to study, not skins to extend.

          Before designing a new edition, read two or three earlier pieces for tension, room, type, and motion. Name what you refuse to copy. If the new page could sit beside the last one and look like a language variant of the same template, the signature is wrong.

          Record the study in the article research bundle. Do not paste a catalogue of prior titles, fonts, or palette hex values into the reusable skill.
        MD
      )
      skill_files << "PRECEDENT_STUDY.md"
      skill_files.sort!
    end

    fragment = <<~FRAG
      ## Literary articles

      Long-form cultural and technical essays are continuous literary prose: scene, mystic and meta texture, story. They are not a ledger of facts stacked as sentences.

      If inhabited experience and the author's viewpoint are missing, stop drafting. Interview until a testimony ledger can carry the piece. Do not invent first-person scenes. Chat and thread dumps are research substrate; published prose must not keep a reconstructible outline of the exchange.

      Use the literary-article skill for drafting, research bundles, visual signature, mirrors, and publish wiring. Use audit-prose-mechanics, audit-prose-coherence, audit-article-claims, and audit-translation-mirrors as separate gates. Prefer serif or sans; do not use monospace as a type voice.

      Project overlay names the publish directory, feed, sitemap, and author identity for this repository.
    FRAG
    write_text(lit.join("exports", "literary-article.md"), transform_markdown(fragment))
    write_text(
      lit.join("README.md"),
      "local/literary-article\n\n" \
      "Shareable literary article drafting, prose rules, research evidence shape, " \
      "styling principles, lexical QA expectations, and always-on editor rules. " \
      "No hostnames, article titles, or repository publish paths.\n",
    )
    skill_paths = skill_files.map { |f| "skills/literary-article/#{f}" }
    write_text(
      lit.join("literary-article.prayspec"),
      prayspec(
        "local/literary-article",
        "Literary article drafting and prose rules",
        ["exports/literary-article.md", *skill_paths],
        {
          "literary-article" => {
            type: "fragment",
            path: "exports/literary-article.md",
            summary: "When to stop, interview, and open the literary-article skill",
          },
          "skill" => {
            type: "folder",
            path: "skills/literary-article",
            summary: "Literary article skill body",
          },
        },
      ),
    )

    rules_pkg = PRAYERS.join("literary-editor-rules")
    rule_names = %w[
      article-no-monospace.mdc
      fact-ledger-and-personal-core.mdc
      obvious-restatement.mdc
      practice-term-calque.mdc
      seed-conversation-recoverability.mdc
    ]
    rules_dir = rules_pkg.join("rules")
    FileUtils.rm_rf(rules_dir) if rules_dir.exist?
    rule_files = []
    rule_names.each do |name|
      src = CURSOR.join(name)
      src = rules_pkg.join("rules", name) unless src.exist?
      next unless src.exist?

      text = transform_markdown(src.read(encoding: "UTF-8"))
      text = text.gsub(
        ".agents/skills/blog-article/TEXT_RULES.md",
        ".agents/skills/literary-article/TEXT_RULES.md",
      )
      text = text.gsub(
        "the literary-article skill/TEXT_RULES.md",
        ".agents/skills/literary-article/TEXT_RULES.md",
      )
      text = text.gsub(
        "the literary-article skill/STYLING_AND_PUBLISHING.md",
        ".agents/skills/literary-article/STYLING_AND_PUBLISHING.md",
      )
      text = text.gsub("\n Prefer:", "\n  Prefer:")
      write_text(rules_dir.join(name), text)
      rule_files << name
    end
    write_text(
      rules_pkg.join("README.md"),
      "local/literary-editor-rules\n\n" \
      "Always-on editor rules for literary prose surfaces. Shareable; no host paths.\n",
    )
    write_text(
      rules_pkg.join("exports", "literary-editor-rules.md"),
      transform_markdown(<<~MD),
        ## Literary editor rules

        Always-on refuse/prefer rules for continuous literary prose. Tree the rules export under the editor rules directory. Do not compose this package into always-on agent context.
      MD
    )
    rule_paths = rule_files.map { |f| "rules/#{f}" }
    write_text(
      rules_pkg.join("literary-editor-rules.prayspec"),
      prayspec(
        "local/literary-editor-rules",
        "Always-on literary editor rules",
        ["exports/literary-editor-rules.md", *rule_paths],
        {
          "literary-editor-rules" => {
            type: "fragment",
            path: "exports/literary-editor-rules.md",
            summary: "Pointer for literary editor rules",
          },
          "rules" => {
            type: "folder",
            path: "rules",
            summary: "Editor rule files",
          },
        },
      ),
    )

    packages = [
      ["audit-prose-mechanics", "Mechanical prose defect scan for literary articles", AGENTS.join("audit-prose-mechanics")],
      ["audit-prose-coherence", "Semantic coherence review for literary articles", AGENTS.join("audit-prose-coherence")],
      ["audit-translation-mirrors", "Language-mirror fidelity review for literary articles", AGENTS.join("audit-translation-mirrors")],
      ["audit-article-claims", "Article claim inventory against research evidence", AGENTS.join("audit-article-claims")],
      ["static-site-seo", "Static literary site discovery and metadata hygiene", AGENTS.join("seo")],
      ["sync-markdown-transcripts", "Recover editorial Markdown from published HTML", AGENTS.join("sync-markdown-transcripts")],
    ]

    packages.each do |folder, summary, src|
      pkg = PRAYERS.join(folder)
      files = copy_tree_transformed(src, pkg.join("skills", folder))
      if folder == "static-site-seo"
        contract = pkg.join("skills", folder, "SITE_CONTRACT.md")
        if contract.exist?
          write_text(
            contract,
            transform_markdown(<<~MD),
              # Site discovery contract

              This file states non-negotiable discovery rules for a static literary site. Fill host, path, and index wiring in the consumer project overlay.

              ## Required signals

              - One canonical URL per public HTML document.
              - Reciprocal hreflang or equivalent language alternate links when mirrors exist.
              - Honest title, description, and article times when the page is an article.
              - Sitemap entries for every public HTML variant that should be discovered.
              - Robots and noindex policy that matches draft versus published intent.
              - Syndication feed items for public articles when the site publishes a feed.

              ## Project overlay

              The consumer repository names its article directory, index page, feed path, sitemap path, origin host, and any IndexNow or search-console tooling. Do not put those host strings into this shared package.
            MD
          )
        end
      end
      write_text(
        pkg.join("exports", "#{folder}.md"),
        transform_markdown(<<~MD),
          ## #{folder}

          #{summary}. Tree the skill export under the agent skills directory. Do not compose this package into always-on agent context.
        MD
      )
      write_text(
        pkg.join("README.md"),
        "local/#{folder}\n\n#{summary}. Shareable skill; consumer overlay owns host paths.\n",
      )
      skill_paths = files.map { |f| "skills/#{folder}/#{f}" }
      write_text(
        pkg.join("#{folder}.prayspec"),
        prayspec(
          "local/#{folder}",
          summary,
          ["exports/#{folder}.md", *skill_paths],
          {
            folder => {
              type: "fragment",
              path: "exports/#{folder}.md",
              summary: "Pointer for #{folder}",
            },
            "skill" => {
              type: "folder",
              path: "skills/#{folder}",
              summary: "#{folder} skill",
            },
          },
        ),
      )
    end

    puts "prepared prayers under #{PRAYERS}"
  end
end

PrepareLiteraryPrayers.main if __FILE__ == $PROGRAM_NAME
