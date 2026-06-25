#!/usr/bin/env elixir
# Shared Bench — mycelium / ant-nest product ecosystem simulation
# Run: elixir shared_bench_simulation.exs
#
# Grid ecology: developers consume tasks and grow features; collaboration lays hyphae;
# feedback spawns tasks; consumers consume features and emit unplanned tech debt;
# debt accrues when not forecast, not invested, not worked — and drags velocity as weight.

defmodule SharedBench.Ecosystem do
  @width 40
  @height 28
  @ticks 280
  @q 0.25
  @p 120.0
  @default_dev_rate 120.0
  @default_consultant_rate 168.0
  @month_ticks 28
  @default_monthly_red_line 45_000.0
  @monthly_red_lines [28_000.0, 45_000.0, 72_000.0]
  @dev_rates [95.0, 120.0, 150.0]
  @operative_per_head 72.0
  @strategic_rates %{tight: 18.0, neutral: 38.0, loose: 62.0}

  @patterns [
    :cce, :nobody, :solo_serial, :round_robin, :least_loaded, :work_stealing,
    :pair, :swarm_blockers, :everybody, :set_based
  ]

  @usage_levels [0.4, 0.7, 0.9, 1.15]
  @markets [:bull, :bear, :sideways, :volatile]
  @investments [:tight, :neutral, :loose]
  @marketing_levels [0.2, 0.5, 0.8]

  @events [
    {:viral_spike, "Viral spike — demand not in forecast", %{consumers: 4, feedback: 35, debt: 0}},
    {:pipeline_miss, "Pipeline miss — forecast leads did not convert", %{leads: -25, task: 20, debt: 5}},
    {:competitor_launch, "Competitor launch — reactive work blooms", %{task: 30, debt: 15, feedback: 20}},
    {:budget_freeze, "Budget freeze — marketing paused", %{marketing: -0.4}},
    {:enterprise_churn, "Enterprise churn — usage shock", %{consumers: -3, debt: 25, feedback: 15}},
    {:regulatory_surprise, "Regulatory surprise — compliance cluster", %{task: 25, debt: 20}},
    {:macro_shock, "Macro shock — market turns bear", %{market: :bear}},
    {:conference_leads, "Conference leads — random walk-ins", %{leads: 18, feedback: 22}},
    {:forecast_sunshine, "Forecast sunshine — vanity leads, no fit", %{leads: 30, task: 15, feature: -5}},
    {:security_breach, "Security incident — debt hotspot", %{debt: 40, task: 18}},
    {:acqui_interest, "Acquisition interest — runway optimism", %{investment: :loose, leads: 10, morale: 0.06}},
    {:hiring_freeze, "Hiring freeze — bench pressure", %{task: 12, psych: 0.15, morale: -0.05}},
    {:training_cut, "Training budget cut — skill gap widens", %{strategic: -0.3, morale: -0.04}},
    {:platform_bet, "Platform bet — in-house strategic spend", %{strategic: 0.25, experience: 0.03}}
  ]

  defmodule Agent do
    @enforce_keys [:id, :kind, :x, :y]
    defstruct [:id, :kind, :x, :y, :mate, :energy, :billable, :experience, :morale]
  end

  defmodule World do
    defstruct [
      :w, :h, :pattern, :usage, :tick,
      :market, :investment, :marketing,
      :leads, :forecast_leads, :forecast_consumers,
      :marketing_frozen, :events,
      :dev_rate, :consultant_rate, :monthly_red_line, :customer_mood,
      :pred_leads, :pred_consumers, :pred_bench_month, :pred_market, :prediction_intelligence,
      :feature, :task, :debt, :hyphae, :feedback,
      :agents, :metrics
    ]
  end

  def run(seed \\ 20_260_623) do
    :rand.seed(:exsss, {seed, seed, seed})

    results =
      for pattern <- @patterns,
          usage <- @usage_levels,
          _rep <- 1..4 do
        simulate(pattern, usage)
      end

    climate_results =
      for market <- @markets,
          investment <- @investments,
          marketing <- @marketing_levels do
        simulate(:cce, 0.7, market: market, investment: investment, marketing: marketing)
      end

    psych_results =
      for red <- @monthly_red_lines,
          dev <- @dev_rates do
        simulate(:cce, 0.7,
          monthly_red_line: red,
          dev_rate: dev,
          consultant_rate: dev * 1.4
        )
      end

    %{
      config: %{
        grid: "#{@width}×#{@height}",
        ticks: @ticks,
        devs: 6,
        consultants: 2,
        p: @p,
        q: @q,
        runs: length(results)
      },
      aggregates: aggregate(results),
      climate: aggregate_climate(climate_results),
      psychology: aggregate_psychology(psych_results),
      snapshots: snapshot_extremes(results),
      lifecycle: lifecycle_sample(:cce, 0.7)
    }
  end

  defp simulate(pattern, usage, opts \\ []) do
    world = init_world(pattern, usage, opts)

    world =
      Enum.reduce(1..@ticks, world, fn _t, w ->
        w
        |> tick_recovery()
        |> tick_market_drift()
        |> tick_marketing()
        |> tick_lead_conversion()
        |> tick_random_events()
        |> tick_feedback()
        |> tick_consumers()
        |> tick_agents()
        |> tick_people()
        |> tick_costs()
        |> tick_hyphae_life()
        |> tick_debt_ecology()
        |> tick_predictions()
        |> record_tick()
      end)

    finalize(world)
  end

  defp init_world(pattern, usage, opts \\ []) do
    n = @width * @height
    base = :rand.uniform()
    market = Keyword.get(opts, :market, Enum.random(@markets))
    investment = Keyword.get(opts, :investment, Enum.random(@investments))
    marketing = Keyword.get(opts, :marketing, Enum.random(@marketing_levels))
    dev_rate = Keyword.get(opts, :dev_rate, @default_dev_rate)
    consultant_rate = Keyword.get(opts, :consultant_rate, dev_rate * 1.4)

    monthly_red_line =
      Keyword.get(opts, :monthly_red_line, monthly_red_line_for(investment, usage))

    base_consumers = trunc(4 + usage * 8 * market_consumer_mult(market))

    agents =
      dev_agents(6) ++
        consultant_agents(2) ++
        consumer_agents(base_consumers)

    forecast_leads = marketing * 40 * market_lead_mult(market) * (1 + usage)
    forecast_consumers = base_consumers * 1.15

    %World{
      w: @width,
      h: @height,
      pattern: pattern,
      usage: usage,
      tick: 0,
      market: market,
      investment: investment,
      marketing: marketing,
      leads: forecast_leads * 0.85,
      forecast_leads: forecast_leads,
      forecast_consumers: forecast_consumers,
      marketing_frozen: 0,
      events: [],
      dev_rate: dev_rate,
      consultant_rate: consultant_rate,
      monthly_red_line: monthly_red_line,
      customer_mood: 0.55,
      pred_leads: forecast_leads,
      pred_consumers: forecast_consumers,
      pred_bench_month: monthly_red_line_for(investment, usage) * 0.38,
      pred_market: market,
      prediction_intelligence: 0.38,
      feature: seed_grid(n, trunc(base * 12), 0.0),
      task: seed_grid_random(n, 0.18),
      debt: seed_grid(n, 2, 0.0),
      hyphae: seed_grid(n, 0, 0.0),
      feedback: seed_grid_random(n, 0.08),
      agents: agents,
      metrics: init_metrics()
    }
    |> begin_month_predictions()
  end

  defp monthly_red_line_for(:tight, usage), do: 28_000.0 + usage * 8_000
  defp monthly_red_line_for(:loose, usage), do: 58_000.0 + usage * 18_000
  defp monthly_red_line_for(_, usage), do: 38_000.0 + usage * 12_000

  defp dev_agents(n) do
    for i <- 1..n do
      %Agent{
        id: i,
        kind: :dev,
        x: rem(i * 7, @width),
        y: rem(i * 5, @height),
        mate: if(rem(i, 2) == 0, do: i - 1, else: i + 1),
        energy: 1.0,
        billable: 0.0,
        experience: 0.42 + :rand.uniform() * 0.12,
        morale: 0.52 + :rand.uniform() * 0.12
      }
    end
  end

  defp consultant_agents(n) do
    for i <- 1..n do
      %Agent{
        id: 100 + i,
        kind: :consultant,
        x: rem(i * 11, @width),
        y: rem(i * 3, @height),
        mate: nil,
        energy: 1.0,
        billable: 0.0,
        experience: 0.55 + :rand.uniform() * 0.1,
        morale: 0.5 + :rand.uniform() * 0.1
      }
    end
  end

  defp consumer_agents(n) do
    for i <- 1..n do
      edge = Enum.random([:top, :bottom, :left, :right])
      {x, y} =
        case edge do
          :top -> {:rand.uniform(@width) - 1, 0}
          :bottom -> {:rand.uniform(@width) - 1, @height - 1}
          :left -> {0, :rand.uniform(@height) - 1}
          :right -> {@width - 1, :rand.uniform(@height) - 1}
        end

      %Agent{
        id: 200 + i,
        kind: :consumer,
        x: x,
        y: y,
        mate: nil,
        energy: 0.5 + :rand.uniform() * 0.5,
        billable: 0.0,
        experience: 0.0,
        morale: 0.0
      }
    end
  end

  defp seed_grid(n, val, _) do
    Map.new(0..(n - 1), fn i -> {i, val} end)
  end

  defp seed_grid_random(n, density) do
    Map.new(0..(n - 1), fn i ->
      {i, if(:rand.uniform() < density, do: 20 + trunc(:rand.uniform() * 50), else: 0)}
    end)
  end

  defp idx(w, x, y), do: y * w.w + x

  defp in_bounds?(w, x, y), do: x >= 0 and x < w.w and y >= 0 and y < w.h

  defp aget(m, i), do: Map.get(m, i, 0)

  defp get(grid, w, x, y), do: aget(grid, idx(w, x, y))

  defp grid_sum(grid),
    do: grid |> Map.values() |> Enum.filter(&is_number/1) |> Enum.sum()

  defp update_cell(w, field, x, y, fun) do
    i = idx(w, x, y)
    grid = Map.fetch!(w, field)
    Map.put(w, field, Map.put(grid, i, fun.(aget(grid, i))))
  end

  defp neighbors(w, x, y) do
    for dx <- -1..1, dy <- -1..1, {dx, dy} != {0, 0}, in_bounds?(w, x + dx, y + dy) do
      {x + dx, y + dy}
    end
  end

  # --- market / climate ticks ---

  defp tick_market_drift(w) do
    market =
      case w.market do
        :volatile ->
          if :rand.uniform() < 0.04, do: Enum.random(@markets), else: :volatile

        :sideways ->
          if :rand.uniform() < 0.01, do: Enum.random([:bull, :bear, :sideways]), else: :sideways

        m ->
          m
      end

    %{w | market: market}
  end

  defp tick_marketing(w) do
    frozen = max(0, w.marketing_frozen - 1)
    eff = max(0.0, w.marketing + if(frozen > 0, do: -0.5, else: 0.0))
    roi = market_roi_mult(w.market) * investment_budget_mult(w.investment)
    burst = eff * roi * (2.5 + w.usage)

  {x, y} = {:rand.uniform(w.w) - 1, :rand.uniform(w.h) - 1}
    i = idx(w, x, y)

    feedback =
      Map.update!(w.feedback, i, fn fb ->
        min(100, fb + burst * (0.6 + :rand.uniform() * 0.4))
      end)

    leads = w.leads + eff * market_lead_mult(w.market) * (1.2 + :rand.uniform() * 0.8)

    %{w | feedback: feedback, leads: leads, marketing_frozen: frozen}
  end

  defp tick_lead_conversion(w) do
    gap = max(0.0, market_skill_index(w.market) - avg_experience(w.agents))
    mood = w.customer_mood || 0.55
    rate = lead_conversion_rate(w.market, w.investment) * max(0.4, 1.0 - gap * 0.35) * (0.72 + mood * 0.35)
    convert = min(w.leads, w.leads * rate + :rand.uniform() * 3)
    remaining = max(0, w.leads - convert)

    w =
      if convert > 8 and :rand.uniform() < 0.35 do
        spawn_consumer(w)
      else
        w
      end

    w =
      if convert > 5 do
        {x, y} = {:rand.uniform(w.w) - 1, :rand.uniform(w.h) - 1}
        update_cell(w, :feedback, x, y, &min(100, &1 + convert * 0.15))
      else
        w
      end

    %{w | leads: remaining}
  end

  defp tick_random_events(w) do
    base_chance = unforecast_chance(w)

    if :rand.uniform() < base_chance do
      {id, label, effects} = Enum.random(@events)
      apply_event(w, id, label, effects)
    else
      w
    end
  end

  defp unforecast_chance(w) do
    plan_gap = forecast_miss_current(w)
    team_gap = team_prediction_miss(w)

    0.012 + plan_gap * 0.015 + team_gap * 0.025 +
      if(w.market == :volatile, do: 0.02, else: 0.0)
  end

  defp prediction_intelligence(w) do
    exp = avg_experience(w.agents)
    mor = avg_morale(w.agents)
    grid = w.w * w.h
    hy = grid_sum(w.hyphae) / max(grid * 45, 1)
    strat = min(1.0, w.metrics.strategic_in_house / 70_000)
    collab = min(1.0, w.metrics.collab_events / 350)
    gap_penalty = max(0.0, market_skill_index(w.market) - exp) * 0.25

    base =
      (0.34 * exp + 0.18 * mor + 0.2 * hy + 0.16 * strat + 0.12 * collab - gap_penalty)
      |> max(0.12)
      |> min(0.94)

    outside_gain = Map.get(w.metrics, :iq_over_outside_avg, 0.5)
    min(0.94, max(0.12, base * 0.65 + outside_gain * 0.35))
  end

  defp outside_view_bench_median(w) do
    case Map.get(w.metrics, :bench_month_history, []) do
      [] ->
        w.monthly_red_line * 0.38

      history ->
        sorted = Enum.sort(history)
        mid = div(length(sorted), 2)

        if rem(length(sorted), 2) == 1 do
          Enum.at(sorted, mid)
        else
          (Enum.at(sorted, mid - 1) + Enum.at(sorted, mid)) / 2.0
        end
    end
  end

  defp bench_outside_view_error(w, month_spend) do
    baseline = outside_view_bench_median(w)
    abs(month_spend - baseline) / max(baseline, 1.0)
  end

  defp push_bench_month_history(m, month_spend) do
    history = Map.get(m, :bench_month_history, []) ++ [month_spend * 1.0]
    %{m | bench_month_history: Enum.take(history, -3)}
  end

  defp consumer_count(w), do: Enum.count(w.agents, &(&1.kind == :consumer))

  defp update_velocities(m, consumers, leads, bench_cost) do
  prev_c = Map.get(m, :prev_consumers, consumers)
  prev_l = Map.get(m, :prev_leads, leads)
  prev_b = Map.get(m, :prev_bench_cost, bench_cost)

    %{
      m
      | prev_consumers: consumers,
        prev_leads: leads,
        prev_bench_cost: bench_cost,
        consumer_vel: Map.get(m, :consumer_vel, 0) * 0.65 + (consumers - prev_c) * 0.35,
        lead_vel: Map.get(m, :lead_vel, 0) * 0.65 + (leads - prev_l) * 0.35,
        bench_vel: Map.get(m, :bench_vel, 0) * 0.65 + (bench_cost - prev_b) * 0.35
    }
  end

  defp signal_consumer_forecast(w, consumers, horizon) do
    mkt = market_consumer_mult(w.market)
    conv = lead_conversion_rate(w.market, w.investment)
    mood = w.customer_mood || 0.55
    growth = w.usage * mkt * 0.06 * (0.55 + conv * 4 + mood * 0.2)
    consumers + growth * horizon
  end

  defp signal_lead_forecast(w, horizon) do
    eff = max(0.0, w.marketing - if(w.marketing_frozen > 0, do: 0.5, else: 0.0))
    inflow = eff * market_lead_mult(w.market) * (1.1 + :rand.uniform() * 0.6)
    outflow = w.leads * lead_conversion_rate(w.market, w.investment) * 0.85
    max(0.0, w.leads + (inflow - outflow) * horizon / max(@month_ticks, 1))
  end

  defp signal_bench_forecast(w, horizon) do
    heads = Enum.count(w.agents, &(&1.kind in [:dev, :consultant]))
    pattern_stress =
      case w.pattern do
        :everybody -> 1.55
        :nobody -> 0.15
        :pair -> 1.2
        :swarm_blockers -> 1.15
        _ -> 1.0
      end

    rate = heads * @q * (w.dev_rate * 0.75 + w.consultant_rate * 0.25) * pattern_stress * w.usage
    w.metrics.month_bench_spend + rate * horizon
  end

  defp predict_market(w, iq) do
    conv = lead_conversion_rate(w.market, w.investment)
    miss = team_prediction_miss(w)

    guess =
      cond do
        w.market == :volatile -> :volatile
        miss > 0.55 and conv < 0.04 -> :bear
        w.marketing > 0.65 and conv > 0.06 -> :bull
        true -> w.market
      end

    if :rand.uniform() < iq or guess == w.market, do: guess, else: w.market
  end

  defp blend(naive, signal, iq), do: naive * (1.0 - iq) + signal * iq

  defp team_prediction_miss(w) do
    consumers = consumer_count(w)
    lead_miss = abs(w.leads - (w.pred_leads || w.forecast_leads)) / max(w.pred_leads || w.forecast_leads, 1)
    consumer_miss = abs(consumers - (w.pred_consumers || w.forecast_consumers)) / max(w.pred_consumers || w.forecast_consumers, 1)

    bench_miss =
      abs(w.metrics.month_bench_spend - (w.pred_bench_month || 1)) /
        max(w.pred_bench_month || 1, 1)

    market_miss = if(w.pred_market == w.market, do: 0.0, else: 0.35)
    (lead_miss + consumer_miss + bench_miss) / 3 + market_miss * 0.15
  end

  defp tick_predictions(w) do
    iq = prediction_intelligence(w)
    consumers = consumer_count(w)
    bench_cost = bench_cost_total(w)
    m = update_velocities(w.metrics, consumers, w.leads, bench_cost)
    horizon = max(@month_ticks - rem(w.tick, @month_ticks), 1)

    naive_c = consumers + m.consumer_vel * horizon
    naive_l = max(0.0, w.leads + m.lead_vel * horizon)

    naive_bench =
      case Map.get(m, :bench_month_history, []) do
        [] ->
          m.month_bench_spend + m.bench_vel * horizon

        _ ->
          outside = outside_view_bench_median(w)
          outside * (1.0 + horizon / @month_ticks * 0.08) + m.month_bench_spend * 0.25
      end

    signal_c = signal_consumer_forecast(w, consumers, horizon)
    signal_l = signal_lead_forecast(w, horizon)
    signal_bench = signal_bench_forecast(w, horizon)

    noise = (1.0 - iq) * 0.12

    pred_c =
      blend(naive_c, signal_c, iq) * (1.0 + (:rand.uniform() - 0.5) * noise)

    pred_l =
      blend(naive_l, signal_l, iq) * (1.0 + (:rand.uniform() - 0.5) * noise)

    pred_bench =
      blend(naive_bench, signal_bench, iq) * (1.0 + (:rand.uniform() - 0.5) * noise)

    pred_market = predict_market(w, iq)
    team_miss = team_prediction_miss(%{w | pred_consumers: pred_c, pred_leads: pred_l, pred_bench_month: pred_bench, pred_market: pred_market})

    m = %{
      m
      | intelligence_peak: max(Map.get(m, :intelligence_peak, 0), iq),
        team_prediction_miss_peak: max(Map.get(m, :team_prediction_miss_peak, 0), team_miss)
    }

    %{
      w
      | pred_leads: max(0.0, pred_l),
        pred_consumers: max(0.0, pred_c),
        pred_bench_month: max(0.0, pred_bench),
        pred_market: pred_market,
        prediction_intelligence: iq,
        metrics: m
    }
  end

  defp begin_month_predictions(w) do
    snap = %{
      leads: w.pred_leads,
      consumers: w.pred_consumers,
      bench: w.pred_bench_month,
      market: w.pred_market
    }

    %{w | metrics: %{w.metrics | month_pred_snap: snap}}
  end

  defp month_plan_miss(w) do
    month_tick = if rem(w.tick, @month_ticks) == 0, do: @month_ticks, else: rem(w.tick, @month_ticks)
    consumers = consumer_count(w)
    lead_plan = w.forecast_leads * (month_tick / @month_ticks * 1.0)
    lead_miss = abs(w.leads - lead_plan) / max(w.forecast_leads, 1)
    consumer_miss = abs(consumers - w.forecast_consumers) / max(w.forecast_consumers, 1)
    min(1.2, lead_miss + consumer_miss)
  end

  defp month_close_prediction_error(w, month_spend) do
    case Map.get(w.metrics, :month_pred_snap) do
      nil ->
        0.0

      s ->
        consumers = consumer_count(w)
        lead_miss = abs(w.leads - s.leads) / max(s.leads, 1.0)
        consumer_miss = abs(consumers - s.consumers) / max(s.consumers, 1.0)
        bench_miss = abs(month_spend - s.bench) / max(s.bench, 1.0)
        market_miss = if(s.market == w.market, do: 0.0, else: 1.0)
        (lead_miss + consumer_miss + bench_miss) / 3 + market_miss * 0.12
    end
  end

  defp score_month_predictions(w, month_spend) do
    err = month_close_prediction_error(w, month_spend)
    outside_err = bench_outside_view_error(w, month_spend)

    inside_bench_err =
      case Map.get(w.metrics, :month_pred_snap) do
        nil -> err
        s -> abs(month_spend - s.bench) / max(s.bench, 1.0)
      end

    iq_gain = max(0.0, min(1.0, (outside_err - inside_bench_err) / max(outside_err, 0.01)))

    m = w.metrics
    n = Map.get(m, :prediction_scores, 0) + 1
    sum = Map.get(m, :prediction_error_sum, 0.0) + err
    iq_n = Map.get(m, :iq_over_outside_scores, 0) + 1
    iq_sum = Map.get(m, :iq_over_outside_sum, 0.0) + iq_gain
    outside_avg = Map.get(m, :outside_view_error_avg, 0.0) * 0.65 + outside_err * 0.35

    %{
      w.metrics
      | prediction_error_sum: sum,
        prediction_scores: n,
        prediction_error_peak: max(Map.get(m, :prediction_error_peak, 0), err),
        prediction_error_avg: sum / n,
        iq_over_outside_sum: iq_sum,
        iq_over_outside_scores: iq_n,
        iq_over_outside_avg: iq_sum / iq_n,
        outside_view_error_avg: outside_avg
    }
  end

  defp apply_event(w, event_id, label, effects) do
    events = Enum.take([label | w.events], 6)
    mttr = event_mttr(event_id)
    rem = Map.get(w.metrics, :recovery_ticks_remaining, 0)

    m =
      w.metrics
      |> Map.put(:surprise_events, w.metrics.surprise_events + 1)
      |> then(fn m0 ->
        if mttr > rem do
          %{m0 |
            recovery_ticks_remaining: mttr,
            current_incident_mttr: mttr,
            recovery_penalty: 0.55 + 0.45
          }
        else
          m0
        end
      end)

    w = %{w | events: events, metrics: m}

    w =
      Enum.reduce(effects, w, fn
        {:leads, delta}, acc -> %{acc | leads: max(0, acc.leads + delta * 1.0)}
        {:marketing, delta}, acc -> %{acc | marketing: max(0, min(1, acc.marketing + delta))}
        {:marketing_frozen, ticks}, acc -> %{acc | marketing_frozen: max(acc.marketing_frozen, ticks)}
        {:market, mkt}, acc -> %{acc | market: mkt}
        {:investment, inv}, acc -> %{acc | investment: inv}
        {:psych, delta}, acc ->
          %{acc | metrics: %{acc.metrics | psych_drift: Map.get(acc.metrics, :psych_drift, 0) + delta}}
        {:morale, delta}, acc -> adjust_team_morale(acc, delta)
        {:consumers, n}, acc when n > 0 -> spawn_consumers(acc, n)
        {:consumers, n}, acc when n < 0 -> remove_consumers(acc, -n)
        {:feedback, amt}, acc -> deposit_field(acc, :feedback, amt)
        {:task, amt}, acc -> deposit_field(acc, :task, amt)
        {:debt, amt}, acc -> deposit_field(acc, :debt, amt)
        {:feature, amt}, acc -> deposit_field(acc, :feature, amt)
        {:experience, delta}, acc -> boost_team_experience(acc, delta)
        {:strategic, delta}, acc ->
          extra = delta * 40
          %{acc | metrics: %{
            acc.metrics
            | strategic_eur: acc.metrics.strategic_eur + extra,
              strategic_in_house: acc.metrics.strategic_in_house + extra * 0.65
          }}
        _, acc -> acc
      end)

    if Map.get(effects, :marketing, 0) < 0 do
      %{w | marketing_frozen: max(w.marketing_frozen, 25)}
    else
      w
    end
  end

  defp event_mttr(:security_breach), do: 22
  defp event_mttr(:regulatory_surprise), do: 18
  defp event_mttr(:macro_shock), do: 16
  defp event_mttr(:enterprise_churn), do: 14
  defp event_mttr(:pipeline_miss), do: 12
  defp event_mttr(:competitor_launch), do: 13
  defp event_mttr(:viral_spike), do: 10
  defp event_mttr(:budget_freeze), do: 8
  defp event_mttr(:conference_leads), do: 8
  defp event_mttr(:forecast_sunshine), do: 9
  defp event_mttr(:acqui_interest), do: 6
  defp event_mttr(:hiring_freeze), do: 10
  defp event_mttr(:training_cut), do: 8
  defp event_mttr(:platform_bet), do: 5
  defp event_mttr(_), do: 12

  defp tick_recovery(w) do
    m = w.metrics
    rem = Map.get(m, :recovery_ticks_remaining, 0)

    m =
      if rem > 0 do
        new_rem = rem - 1
        mttr = Map.get(m, :current_incident_mttr, 12)

        if new_rem <= 0 do
          %{
            m
            | recovery_ticks_remaining: 0,
              recovery_ticks_total: Map.get(m, :recovery_ticks_total, 0) + mttr,
              incidents_resolved: Map.get(m, :incidents_resolved, 0) + 1,
              recovery_penalty: 1.0
          }
        else
          %{
            m
            | recovery_ticks_remaining: new_rem,
              recovery_penalty: 0.55 + 0.45 * (new_rem / max(mttr, 1))
          }
        end
      else
        %{m | recovery_penalty: 1.0}
      end

    %{w | metrics: m}
  end

  defp complexity_median(w) do
    vals =
      for x <- 0..(w.w - 1), y <- 0..(w.h - 1) do
        get(w.task, w, x, y) + get(w.debt, w, x, y)
      end
      |> Enum.sort()

    Enum.at(vals, div(length(vals), 2)) || 0.0
  end

  defp pair_complexity_mult(w, x, y) do
    if w.pattern != :pair do
      1.0
    else
      local = get(w.task, w, x, y) + get(w.debt, w, x, y)
      if local > complexity_median(w), do: 1.18, else: 0.85
    end
  end

  defp boost_team_experience(w, delta) do
    agents =
      Enum.map(w.agents, fn a ->
        if a.kind in [:dev, :consultant] do
          %{a | experience: min(1.0, max(0.1, (a.experience || 0.5) + delta))}
        else
          a
        end
      end)

    %{w | agents: agents}
  end

  defp adjust_team_morale(w, delta) do
    agents =
      Enum.map(w.agents, fn a ->
        if a.kind in [:dev, :consultant] do
          %{a | morale: min(1.0, max(0.1, (a.morale || 0.5) + delta))}
        else
          a
        end
      end)

    %{w | agents: agents}
  end

  defp deposit_field(w, _field, amount) when amount == 0, do: w

  defp deposit_field(w, field, amount) when amount != 0 do
    n = max(1, trunc(abs(amount) / 15))
    Enum.reduce(1..n, w, fn _, acc ->
      {x, y} = {:rand.uniform(acc.w) - 1, :rand.uniform(acc.h) - 1}
      update_cell(acc, field, x, y, &min(100, max(0, &1 + amount / n)))
    end)
  end

  defp spawn_consumer(w) do
    id = 200 + Enum.count(w.agents, &(&1.kind == :consumer)) + 1
    edge = Enum.random([:top, :bottom, :left, :right])

    {x, y} =
      case edge do
        :top -> {:rand.uniform(w.w) - 1, 0}
        :bottom -> {:rand.uniform(w.w) - 1, w.h - 1}
        :left -> {0, :rand.uniform(w.h) - 1}
        :right -> {w.w - 1, :rand.uniform(w.h) - 1}
      end

    a = %Agent{id: id, kind: :consumer, x: x, y: y, mate: nil, energy: 0.6, billable: 0.0}
    %{w | agents: w.agents ++ [a]}
  end

  defp spawn_consumers(w, n) do
    Enum.reduce(1..n, w, fn _, acc -> spawn_consumer(acc) end)
  end

  defp remove_consumers(w, n) do
    {consumers, rest} = Enum.split_with(w.agents, &(&1.kind == :consumer))
    drop = min(n, length(consumers))
    %{w | agents: rest ++ Enum.drop(consumers, drop)}
  end

  defp market_consumer_mult(:bull), do: 1.25
  defp market_consumer_mult(:bear), do: 0.75
  defp market_consumer_mult(:sideways), do: 1.0
  defp market_consumer_mult(:volatile), do: 0.85 + :rand.uniform() * 0.5

  defp market_lead_mult(:bull), do: 1.35
  defp market_lead_mult(:bear), do: 0.65
  defp market_lead_mult(:sideways), do: 1.0
  defp market_lead_mult(:volatile), do: 0.7 + :rand.uniform() * 0.6

  defp market_roi_mult(:bull), do: 1.2
  defp market_roi_mult(:bear), do: 0.55
  defp market_roi_mult(:sideways), do: 1.0
  defp market_roi_mult(:volatile), do: 0.6 + :rand.uniform() * 0.8

  defp investment_budget_mult(:tight), do: 0.6
  defp investment_budget_mult(:neutral), do: 1.0
  defp investment_budget_mult(:loose), do: 1.4

  defp lead_conversion_rate(:bull, _), do: 0.08
  defp lead_conversion_rate(:bear, :tight), do: 0.02
  defp lead_conversion_rate(:bear, _), do: 0.035
  defp lead_conversion_rate(:volatile, _), do: 0.05 + :rand.uniform() * 0.04
  defp lead_conversion_rate(_, :loose), do: 0.07
  defp lead_conversion_rate(_, _), do: 0.05

  # --- ecology ticks ---

  defp tick_feedback(w) do
    {task, feedback} =
      Enum.reduce(0..(w.w * w.h - 1), {w.task, w.feedback}, fn i, {t, f} ->
        fb = aget(f, i)
        hy = aget(w.hyphae, i)
        tk = aget(t, i)

        cond do
          fb > 25 and hy > 10 ->
            spawn = min(40, trunc(fb * 0.35))
            {Map.put(t, i, min(100, tk + spawn)), Map.put(f, i, max(0, trunc(fb - spawn * 0.5)))}

          fb > 40 ->
            {Map.put(t, i, min(100, tk + 12)), Map.put(f, i, max(0, fb - 12))}

          true ->
            {t, f}
        end
      end)

    %{w | task: task, feedback: feedback}
  end

  defp tick_consumers(w) do
    Enum.reduce(w.agents, {w, []}, fn a, {world, acc} ->
      if a.kind == :consumer do
        {world2, a2} = consumer_step(world, a)
        {world2, [a2 | acc]}
      else
        {world, [a | acc]}
      end
    end)
    |> then(fn {world, agents} -> %{world | agents: Enum.reverse(agents)} end)
  end

  defp consumer_step(w, a) do
    {x, y} = best_step(w, a.x, a.y, fn wx, wy ->
      get(w.feature, w, wx, wy) * 1.2 + get(w.feedback, w, wx, wy) * 0.3 - get(w.debt, w, wx, wy) * 0.4
    end)

    feat = get(w.feature, w, x, y)
    consumed = min(18, feat)

    consumed_debt = consumed * 0.25 * w.usage

    w =
      w
      |> update_cell(:feature, x, y, &max(0, &1 - consumed))
      |> update_cell(:feedback, x, y, &min(100, &1 + consumed * 0.4))
      |> update_cell(:debt, x, y, &min(100, &1 + consumed_debt))
      |> bump_metric(:debt_accrued, consumed_debt)

    w =
      if :rand.uniform() < spawn_chance(w) do
        {sx, sy} = pick_neighbor(w, x, y)
        update_cell(w, :task, sx, sy, &min(100, &1 + 15))
      else
        w
      end

    {w, %{a | x: x, y: y, energy: min(1.5, a.energy + consumed * 0.02)}}
  end

  defp spawn_chance(w) do
    base = if(w.usage > 1.0, do: 0.04, else: 0.015)
    market = case w.market do
      :bull -> 1.3
      :bear -> 0.7
      :volatile -> 0.9 + :rand.uniform() * 0.3
      _ -> 1.0
    end
    base * market
  end

  defp tick_agents(w) do
    if w.pattern == :nobody do
      w
    else
      Enum.reduce(w.agents, {w, []}, fn a, {world, acc} ->
        if a.kind in [:dev, :consultant] do
          {world2, a2} = agent_step(world, a)
          {world2, [a2 | acc]}
        else
          {world, [a | acc]}
        end
      end)
      |> then(fn {world, agents} -> %{world | agents: Enum.reverse(agents)} end)
    end
  end

  defp agent_step(w, a) do
    {x, y} = target_step(w, a)
    task = get(w.task, w, x, y)
    debt = get(w.debt, w, x, y)

    {w, work, bill} =
      cond do
        should_pay_debt?(w, a, task, debt) ->
          fix = min(22, debt * if(debt_patrol_active?(w), do: 0.28, else: 0.22))
          w =
            w
            |> update_cell(:debt, x, y, &max(0, &1 - fix))
            |> bump_metric(:debt_paid, fix)

          {w, fix * 0.5, billable_hours(w, a, fix * 0.5)}

        debt > 28 and w.pattern in [:swarm_blockers, :cce, :pair] and task < 22 ->
          fix = min(15, debt * 0.2)
          w =
            w
            |> update_cell(:debt, x, y, &max(0, &1 - fix))
            |> bump_metric(:debt_paid, fix)

          {w, fix * 0.5, billable_hours(w, a, fix * 0.5)}

        task > 8 ->
          yield = work_yield(w, a, task, debt, x, y)
          scope = scope_creep(w, a)
          hy_gain = hyphae_deposit(w, a, x, y)

          w =
            w
            |> update_cell(:task, x, y, &max(0, &1 - yield))
            |> update_cell(:feature, x, y, &min(100, &1 + yield * 0.85))
            |> update_cell(:hyphae, x, y, &min(100, &1 + hy_gain))
            |> maybe_spawn_task(x, y, scope)
            |> then(fn w2 -> if yield > 3, do: bump_metric(w2, :change_attempts, 1), else: w2 end)

          {w, yield, billable_hours(w, a, yield)}

        true ->
          {w, 0, @q * 0.2}
      end

    bill = ensure_num(bill)
    work = ensure_num(work)
    a = %{a | x: x, y: y, billable: ensure_num(a.billable) + bill, energy: a.energy - 0.01 + work * 0.02}
    {w, a}
  end

  defp debt_fix_pattern?(p),
    do: p in [:work_stealing, :least_loaded, :cce, :swarm_blockers, :pair]

  defp debt_patrol_active?(w), do: debt_weight(w) > 0.36 or w.usage >= 0.85

  defp should_pay_debt?(w, a, task, debt) do
    debt_fix_pattern?(w.pattern) and debt >= 16 and
      (
        (debt > 30 and task < 20) or
          (debt_weight(w) > 0.42 and debt > 20 and
             (task < 24 or rem(a.id + w.tick, 4) == 0)) or
          (debt_weight(w) > 0.5 and debt > 18 and rem(a.id + w.tick, 3) != 1)
      )
  end

  defp debt_rot_target(w, a) do
    peaks =
      0..(w.w * w.h - 1)
      |> Enum.map(fn i ->
        {rem(i, w.w), div(i, w.w), aget(w.debt, i)}
      end)
      |> Enum.filter(fn {_, _, d} -> d >= 20 end)
      |> Enum.sort_by(fn {_, _, d} -> d end, :desc)

    case peaks do
      [] -> global_hotspot(w)
      list ->
        slot = min(length(list), 8)
        {x, y, _} = Enum.at(list, rem(a.id + div(w.tick, 36), slot))
        {x, y}
    end
  end

  defp step_toward(w, ax, ay, hops, score_fn) do
    Enum.reduce(1..hops, {ax, ay}, fn _, {x, y} ->
      best_step(w, x, y, score_fn)
    end)
  end

  defp debt_patrol_step(w, a) do
    {tx, ty} = debt_rot_target(w, a)
    score_fn = score_forage(w, a, true)

    step_toward(w, a.x, a.y, 3, fn x, y ->
      score_fn.(x, y) - (abs(x - tx) + abs(y - ty)) * 0.18
    end)
  end

  defp score_forage(w, a, patrol?) do
    patrol = patrol? || debt_patrol_active?(w)
    weight = debt_weight(w)

    if patrol do
      {tx, ty} = debt_rot_target(w, a)

      fn x, y ->
        debt = get(w.debt, w, x, y)
        load = local_worker_load(w, x, y)
        debt * 1.15 - load * 7 + get(w.task, w, x, y) * 0.2 + get(w.hyphae, w, x, y) * 0.08 -
          (abs(x - tx) + abs(y - ty)) * 0.18
      end
    else
      hy_w = if weight > 0.45, do: 0.38, else: 0.6

      fn x, y ->
        get(w.task, w, x, y) + get(w.hyphae, w, x, y) * hy_w - get(w.debt, w, x, y) * 0.15
      end
    end
  end

  defp work_yield(w, a, task, debt, x, y) do
    base = min(22, task * 0.35)
    local_slow = 1.0 - min(0.55, debt / 100)
    weight = debt_weight(w)
    global_slow = max(0.25, 1.0 - weight)
    recovery = Map.get(w.metrics, :recovery_penalty, 1.0)
    mult = pattern_efficiency(w.pattern, a.kind) * people_mult(a) * pair_complexity_mult(w, x, y)
    base * local_slow * global_slow * mult * recovery
  end

  defp debt_weight(w) do
    total_debt = grid_sum(w.debt)
    total_feat = max(grid_sum(w.feature), 1.0)
    grid = w.w * w.h * 1.0

    min(0.88, total_debt / (grid * 35) + total_debt / total_feat / 100)
  end

  defp forecast_miss_current(w) do
    consumers = Enum.count(w.agents, &(&1.kind == :consumer))

    abs(w.leads - w.forecast_leads * (w.tick / max(@ticks, 1))) / max(w.forecast_leads, 1) +
      abs(consumers - w.forecast_consumers) / max(w.forecast_consumers, 1)
  end

  defp bump_metric(w, key, delta) when delta > 0 do
    %{w | metrics: Map.update!(w.metrics, key, &(&1 + delta * 1.0))}
  end

  defp bump_metric(w, _, _), do: w

  defp people_mult(a) when a.kind in [:dev, :consultant] do
    exp = Map.get(a, :experience) || 0.5
    mor = Map.get(a, :morale) || 0.5
    (0.65 + 0.35 * exp) * (0.75 + 0.25 * mor)
  end

  defp people_mult(_), do: 1.0

  defp tick_people(w) do
    hy_at = fn x, y -> get(w.hyphae, w, x, y) end
    collab_fruit = fruiting_score(w)

    agents =
      Enum.map(w.agents, fn a ->
        if a.kind not in [:dev, :consultant] do
          a
        else
          local_hy = hy_at.(a.x, a.y)
          local_debt = get(w.debt, w, a.x, a.y)
          collab = if nearby_devs?(w, a), do: 1.0, else: 0.0
          exp_gain = 0.002 * local_hy / 50 * (1 + collab) + collab_fruit * 0.001
          mor_delta =
            cond do
              w.pattern == :nobody -> -0.004
              w.pattern == :everybody and collab < 1 -> -0.003
              local_hy > 20 and collab > 0 -> 0.003
              local_debt > 40 -> -0.002
              collab_fruit > 0.02 -> 0.002
              true -> -0.0005
            end

          strat_boost = w.metrics.strategic_in_house / max(@ticks * 200, 1) * 0.5
          exp = min(1.0, max(0.1, (a.experience || 0.5) + exp_gain + strat_boost * 0.01))
          mor = min(1.0, max(0.1, (a.morale || 0.5) + mor_delta))
          %{a | experience: exp, morale: mor}
        end
      end)

    %{w | agents: agents}
  end

  defp fruiting_score(w) do
    total_hy = grid_sum(w.hyphae)
    total_feat = grid_sum(w.feature)
    if total_hy > 500, do: min(0.08, total_feat / max(total_hy, 1) * 0.0001), else: 0.0
  end

  defp tick_costs(w) do
    heads = Enum.count(w.agents, &(&1.kind in [:dev, :consultant]))
    wage = market_wage_mult(w.market)
    world = 1.0 + w.usage * 0.12
    operative = heads * @operative_per_head * wage * world

    strat_rate = Map.get(@strategic_rates, w.investment, 38.0)
    market_slice = strat_rate * 0.35 * market_roi_mult(w.market)
    in_house_slice = strat_rate * 0.65
    strategic = market_slice + in_house_slice

    skill_gap = max(0.0, market_skill_index(w.market) - avg_experience(w.agents))
    strategic = strategic * (1.0 + skill_gap * 0.4)

    m = %{
      w.metrics
      | operative_eur: w.metrics.operative_eur + operative,
        strategic_eur: w.metrics.strategic_eur + strategic,
        strategic_in_house: w.metrics.strategic_in_house + in_house_slice,
        strategic_market: w.metrics.strategic_market + market_slice
    }

    %{w | metrics: m}
  end

  defp avg_experience(agents) do
    devs = Enum.filter(agents, &(&1.kind in [:dev, :consultant]))

    if devs == [] do
      0.5
    else
      Enum.sum(Enum.map(devs, fn a -> a.experience || 0.5 end)) / length(devs)
    end
  end

  defp avg_morale(agents) do
    devs = Enum.filter(agents, &(&1.kind in [:dev, :consultant]))

    if devs == [] do
      0.5
    else
      Enum.sum(Enum.map(devs, fn a -> a.morale || 0.5 end)) / length(devs)
    end
  end

  defp market_wage_mult(:bull), do: 1.22
  defp market_wage_mult(:bear), do: 0.92
  defp market_wage_mult(:sideways), do: 1.0
  defp market_wage_mult(:volatile), do: 0.95 + :rand.uniform() * 0.2

  defp market_skill_index(:bull), do: 0.78
  defp market_skill_index(:bear), do: 0.58
  defp market_skill_index(:sideways), do: 0.66
  defp market_skill_index(:volatile), do: 0.62 + :rand.uniform() * 0.12

  defp scope_creep(w, a) do
    base = if a.kind == :consultant, do: 0.35, else: 0.12

    mult =
      if w.pattern == :cce,
        do: cce_scope_mult(cce_mode(w, a)),
        else: pattern_scope(w.pattern)

    base * mult
  end

  defp hyphae_deposit(w, a, x, y) do
    base = if a.kind == :consultant, do: 4.0, else: 6.0
    collab = if nearby_devs?(w, a), do: 1.6, else: 1.0
    pair_hy = if pair_complexity_mult(w, x, y) > 1.0, do: 1.1, else: 1.0

    mult =
      if w.pattern == :cce,
        do: cce_hyphae_mult(cce_mode(w, a)),
        else: pattern_hyphae(w.pattern)

    base * mult * collab * pair_hy
  end

  defp nearby_devs?(w, a) do
    Enum.count(w.agents, fn o ->
      o.kind == :dev and o.id != a.id and abs(o.x - a.x) <= 1 and abs(o.y - a.y) <= 1
    end) > 0
  end

  defp maybe_spawn_task(w, x, y, amount) when amount > 0.2 do
    if :rand.uniform() < amount do
      {sx, sy} = pick_neighbor(w, x, y)
      miss = forecast_miss_current(w)

      if :rand.uniform() < 0.12 + miss * 0.08 do
        w
        |> update_cell(:debt, sx, sy, &min(100, &1 + 10 + trunc(:rand.uniform() * 15)))
        |> bump_metric(:debt_accrued, 12.0)
      else
        update_cell(w, :task, sx, sy, &min(100, &1 + 10 + trunc(:rand.uniform() * 20)))
      end
    else
      w
    end
  end

  defp maybe_spawn_task(w, _, _, _), do: w

  defp ensure_num(v) when is_number(v), do: v * 1.0
  defp ensure_num(_), do: 0.0

  defp billable_hours(w, a, work) do
    floor = if work > 0.01, do: @q, else: 0
    participants = pattern_participants(w, a)
    max(floor, work * 0.08) * participants
  end

  defp bench_cost_total(w) do
    Enum.reduce(w.agents, 0.0, fn a, s ->
      h = if is_number(a.billable), do: a.billable * 1.0, else: 0.0

      r =
        case a.kind do
          :consultant -> w.consultant_rate
          :dev -> w.dev_rate
          _ -> 0.0
        end

      s + h * r
    end)
  end

  defp customer_mood_label(mood) when mood >= 0.72, do: "delighted"
  defp customer_mood_label(mood) when mood >= 0.58, do: "pleased"
  defp customer_mood_label(mood) when mood >= 0.42, do: "guarded"
  defp customer_mood_label(_), do: "frustrated"

  defp close_sim_month(w, month_spend) do
    ratio = month_spend / max(w.monthly_red_line, 1.0)
    qual = grid_sum(w.feature) / max(grid_sum(w.feature) + grid_sum(w.debt) * 1.2, 1.0)
    weight = debt_weight(w)

    mood_delta =
      cond do
        ratio > 1.3 -> -0.16
        ratio > 1.08 -> -0.09
        ratio > 1.0 -> -0.04
        ratio < 0.5 and qual > 0.42 -> 0.11
        ratio < 0.7 and qual > 0.4 -> 0.07
        ratio < 0.95 and qual > 0.38 -> 0.03
        true -> 0.0
      end

    plan_miss = month_plan_miss(w)
    pred_err = month_close_prediction_error(w, month_spend)
    penalty_scale = if(ratio <= 1.0, do: 0.45, else: 1.0)

    mood_delta =
      mood_delta -
        penalty_scale *
          (min(0.35, weight) * 0.04 + max(0.0, plan_miss - 0.28) * 0.035 + min(0.55, pred_err) * 0.03)

    mood_delta =
      if w.pattern == :everybody and ratio > 0.92,
        do: mood_delta - 0.07,
        else: mood_delta

    mood_delta = if(ratio < 0.85 and qual > 0.5, do: mood_delta + 0.03, else: mood_delta)

    new_mood = min(1.0, max(0.05, (w.customer_mood || 0.55) + mood_delta))

    m = w.metrics
    m = push_bench_month_history(m, month_spend)
    w = %{w | metrics: m}

    scored_metrics = score_month_predictions(w, month_spend)

    %{
      w
      | customer_mood: new_mood,
        metrics: %{
          scored_metrics
          | month_bench_spend: 0.0,
            months_closed: m.months_closed + 1,
            months_over_budget: m.months_over_budget + if(ratio > 1.0, do: 1, else: 0),
            customer_mood_min: min(m.customer_mood_min, new_mood),
            customer_mood_peak: max(m.customer_mood_peak, new_mood),
            month_spend_peak: max(m.month_spend_peak, month_spend),
            bench_cost_prev: bench_cost_total(w)
        }
    }
    |> begin_month_predictions()
  end

  defp target_step(w, a) do
    cond do
      w.pattern == :cce ->
        cce_step(w, a)

      debt_patrol_active?(w) and rem(a.id + w.tick, 3) == 0 ->
        debt_patrol_step(w, a)

      true ->
        pattern_target_step(w, a)
    end
  end

  defp pattern_target_step(w, a) do
    case w.pattern do
      :solo_serial ->
        step_toward(w, a.x, a.y, 2, score_forage(w, a, false))

      :round_robin ->
        best_step(w, a.x, a.y, fn x, y ->
          get(w.task, w, x, y) +
            if(debt_patrol_active?(w), do: get(w.debt, w, x, y) * 0.4, else: 0.0)
        end)

      :least_loaded ->
        step_toward(w, a.x, a.y, 2, fn x, y ->
          local_load = local_worker_load(w, x, y)
          get(w.task, w, x, y) - local_load * 5 + get(w.feature, w, x, y) * 0.1 +
            if(debt_patrol_active?(w), do: get(w.debt, w, x, y) * 0.5, else: 0.0)
        end)

      :work_stealing ->
        step_toward(w, a.x, a.y, 2, score_forage(w, a, false))

      :pair ->
        pair_step(w, a)

      :swarm_blockers ->
        swarm_step(w, a)

      :everybody ->
        global_hotspot(w)

      :set_based ->
        best_step(w, a.x, a.y, score_set_based(w, a))

      :cce ->
        cce_step(w, a)

      :nobody ->
        {a.x, a.y}
    end
  end

  defp score_solo(w, _a), do: fn x, y -> get(w.task, w, x, y) - get(w.hyphae, w, x, y) * 0.3 end
  defp score_task_only(w), do: fn x, y -> get(w.task, w, x, y) end

  defp score_load_balanced(w, a) do
    local_load =
      Enum.count(w.agents, fn o ->
        o.kind in [:dev, :consultant] and abs(o.x - a.x) <= 2 and abs(o.y - a.y) <= 2
      end)

    fn x, y -> get(w.task, w, x, y) - local_load * 5 + get(w.feature, w, x, y) * 0.1 end
  end

  defp score_hyphae_task(w) do
    fn x, y ->
      get(w.task, w, x, y) + get(w.hyphae, w, x, y) * 0.6 - get(w.debt, w, x, y) * 0.2
    end
  end

  defp score_set_based(w, a) do
    fn x, y ->
      get(w.task, w, x, y) * 0.8 + get(w.feedback, w, x, y) * 0.5 +
        if(rem(a.id + x + y, 3) == 0, do: 8, else: 0)
    end
  end

  defp pair_step(w, a) do
    mate = Enum.find(w.agents, &(&1.id == a.mate))
    if mate do
      mx = trunc((a.x + mate.x) / 2)
      my = trunc((a.y + mate.y) / 2)
      best_step(w, a.x, a.y, fn x, y ->
        get(w.task, w, x, y) + get(w.hyphae, w, x, y) * 0.4 -
          (abs(x - mx) + abs(y - my)) * 0.5
      end)
    else
      best_step(w, a.x, a.y, score_hyphae_task(w))
    end
  end

  defp swarm_step(w, a) do
    step_toward(w, a.x, a.y, 2, fn x, y ->
      get(w.debt, w, x, y) * 1.05 + get(w.task, w, x, y) * 0.4 -
        local_worker_load(w, x, y) * 4
    end)
  end

  defp local_worker_load(w, x, y) do
    Enum.count(w.agents, fn o ->
      o.kind in [:dev, :consultant] and abs(o.x - x) <= 2 and abs(o.y - y) <= 2
    end)
  end

  defp patch_uncertainty(w, x, y) do
    fb = get(w.feedback, w, x, y)
    tk = get(w.task, w, x, y)
    hy = get(w.hyphae, w, x, y)
    miss = forecast_miss_current(w)

    raw =
      1.0 + fb / 22.0 + tk / 35.0 + max(0.0, 1.0 - hy / 45.0) * 2.2 + miss * 0.9

    min(5.0, max(1.0, raw))
  end

  defp patch_conflict_risk(w, x, y) do
    db = get(w.debt, w, x, y)
    load = local_worker_load(w, x, y)
    recovery = Map.get(w.metrics, :recovery_ticks_remaining, 0) > 0

    raw =
      1.0 + db / 28.0 + load * 0.55 +
        if(recovery, do: 1.8, else: 0.0) +
        if(forecast_miss_current(w) > 0.65, do: 0.8, else: 0.0)

    min(5.0, max(1.0, raw))
  end

  defp uneven_local_load?(w, x, y) do
    loads =
      for i <- 0..(w.w * w.h - 1) do
        lx = rem(i, w.w)
        ly = div(i, w.w)
        local_worker_load(w, lx, ly) + get(w.task, w, lx, ly) / 40.0
      end

    mine = local_worker_load(w, x, y) + get(w.task, w, x, y) / 40.0
    avg = Enum.sum(loads) / max(length(loads), 1)
    spread = Enum.max(loads) - Enum.min(loads)
    mine > avg * 1.35 or spread > 2.5
  end

  # Manifesto §12 routing — Collaborative Concurrent Extreme candidate method.
  defp cce_mode(w, a) do
    x = a.x
    y = a.y
    u = patch_uncertainty(w, x, y)
    c = patch_conflict_risk(w, x, y)
    db = get(w.debt, w, x, y)
    tk = get(w.task, w, x, y)
    hy = get(w.hyphae, w, x, y)
    recovery = Map.get(w.metrics, :recovery_ticks_remaining, 0) > 0
    routine_small = tk < 18 and u < 2.4 and c < 2.5

    rot_pressure = debt_patrol_active?(w)

    cond do
      rot_pressure and (db < 28 or rem(a.id + w.tick, 5) == 0) ->
        :debt_patrol

      recovery or db > 45 or (db > 32 and tk < 18) or c >= 4.2 ->
        :swarm_blockers

      u >= 4.0 and tk > 22 ->
        :set_based

      u >= 2.8 or (hy < 22 and tk > 28) ->
        :pair

      routine_small and uneven_local_load?(w, x, y) ->
        :least_loaded

      uneven_local_load?(w, x, y) ->
        :work_stealing

      u <= 2.0 and c <= 2.2 ->
        :solo_serial

      true ->
        :least_loaded
    end
  end

  defp cce_step(w, a) do
    case cce_mode(w, a) do
      :debt_patrol -> debt_patrol_step(w, a)
      :swarm_blockers -> swarm_step(w, a)
      :pair -> pair_step(w, a)
      :set_based -> best_step(w, a.x, a.y, score_set_based(w, a))
      :least_loaded -> step_toward(w, a.x, a.y, 2, score_load_balanced(w, a))
      :work_stealing -> step_toward(w, a.x, a.y, 2, score_forage(w, a, false))
      :solo_serial -> step_toward(w, a.x, a.y, 2, score_forage(w, a, false))
    end
  end

  defp global_hotspot(w) do
    best =
      Enum.reduce(0..(w.w * w.h - 1), {0, 0, -1}, fn i, {bx, by, bs} ->
        x = rem(i, w.w)
        y = div(i, w.w)
        s = get(w.task, w, x, y) + get(w.debt, w, x, y)
        if s > bs, do: {x, y, s}, else: {bx, by, bs}
      end)

    {elem(best, 0), elem(best, 1)}
  end

  defp best_step(w, x, y, score_fn) do
    candidates = neighbors(w, x, y) ++ [{x, y}]
    {bx, by, _} =
      Enum.reduce(candidates, {x, y, score_fn.(x, y)}, fn {cx, cy}, {ax, ay, best} ->
        s = score_fn.(cx, cy) + (:rand.uniform() - 0.5) * 2
        if s > best, do: {cx, cy, s}, else: {ax, ay, best}
      end)

    {bx, by}
  end

  defp pick_neighbor(w, x, y) do
    Enum.random(neighbors(w, x, y) ++ [{x, y}])
  end

  defp tick_hyphae_life(w) do
    hyphae =
      Enum.reduce(0..(w.w * w.h - 1), w.hyphae, fn i, acc ->
        x = rem(i, w.w)
        y = div(i, w.w)
        hy = aget(acc, i)
        n_hy = neighbor_sum(w, x, y, w.hyphae)
        feat_n = neighbor_count(w, x, y, w.feature, 15)

        new =
          cond do
            hy > 0 and feat_n >= 2 and n_hy >= 2 -> min(100, hy + 2)
            hy > 0 and n_hy < 1 -> max(0, hy - 3)
            hy == 0 and n_hy >= 3 -> 8
            true -> max(0, hy - 1)
          end

        Map.put(acc, i, new)
      end)

    %{w | hyphae: hyphae}
  end

  defp tick_debt_ecology(w) do
    miss = forecast_miss_current(w)
    in_house_rate = Map.get(@strategic_rates, w.investment, 38.0) * 0.65
    strat_relief_per_cell = in_house_rate / (w.w * w.h) * 0.12

    neglect_mult =
      case w.pattern do
        :nobody -> 2.2
        :solo_serial -> 1.35
        :round_robin -> 1.2
        :everybody -> 1.15
        _ -> 1.0
      end

    invest_pressure =
      case w.investment do
        :tight -> 1.25
        :loose -> 0.88
        _ -> 1.0
      end

    w =
      if miss > 0.9 and :rand.uniform() < 0.18 do
        deposit_field(w, :debt, miss * 14)
        |> bump_metric(:debt_accrued, miss * 14)
      else
        w
      end

    {debt, accrued_tick} =
      Enum.reduce(0..(w.w * w.h - 1), {w.debt, 0.0}, fn i, {acc, accrued} ->
        x = rem(i, w.w)
        y = div(i, w.w)
        d = aget(acc, i)
        n_debt = neighbor_count(w, x, y, acc, 22)
        fb = get(w.feedback, w, x, y)

        unplanned =
          if(d >= 98, do: 0.0,
            else:
              (0.035 * w.usage + miss * 0.03) * neglect_mult * invest_pressure +
                if(fb > 35 and d < 25, do: 0.12, else: 0.0)
          )

        spread =
          cond do
            d >= 98 -> 0.0
            n_debt >= 3 and w.usage >= 0.9 -> 1.8 * w.usage
            n_debt >= 2 and d > 12 -> 0.35
            d > 40 and n_debt < 1 -> 0.06
            true -> 0.0
          end

        relief =
          strat_relief_per_cell +
            if(w.pattern in [:swarm_blockers, :cce] and d > 30, do: 0.04, else: 0.0)

        delta = unplanned + spread - relief
        new_d = min(100, max(0, d + delta))
        {Map.put(acc, i, new_d), accrued + max(0, delta)}
      end)

    m = %{
      w.metrics
      | debt_accrued: w.metrics.debt_accrued + accrued_tick,
        debt_weight_peak: max(Map.get(w.metrics, :debt_weight_peak, 0), debt_weight(%{w | debt: debt}))
    }

    %{w | debt: debt, metrics: m}
  end

  defp neighbor_sum(w, x, y, grid) do
    neighbors(w, x, y)
    |> Enum.map(fn {nx, ny} -> get(grid, w, nx, ny) end)
    |> Enum.sum()
  end

  defp neighbor_count(w, x, y, grid, threshold) do
    neighbors(w, x, y)
    |> Enum.count(fn {nx, ny} -> get(grid, w, nx, ny) >= threshold end)
  end

  defp record_tick(w) do
    m = w.metrics
    total_task = grid_sum(w.task)
    total_feat = grid_sum(w.feature)
    total_debt = grid_sum(w.debt)
    total_hy = grid_sum(w.hyphae)
    consumers = Enum.count(w.agents, &(&1.kind == :consumer))

    forecast_miss =
      abs(w.leads - w.forecast_leads * (w.tick / max(@ticks, 1))) / max(w.forecast_leads, 1) +
        abs(consumers - w.forecast_consumers) / max(w.forecast_consumers, 1)

    prev_feat = Map.get(m, :prev_feature_sum, total_feat)
    delta_feat = total_feat - prev_feat
    feature_velocity = Map.get(m, :feature_velocity, 0) * 0.65 + max(0, delta_feat) * 0.35
    lead_time = total_task / max(feature_velocity, 0.5)

    m = %{
      m
      | peak_task: max(m.peak_task, total_task),
        peak_debt: max(m.peak_debt, total_debt),
        feature_sum: total_feat,
        hyphae_sum: total_hy,
        consumer_peak: max(m.consumer_peak, consumers),
        leads_sum: Map.get(m, :leads_sum, 0) + w.leads,
        forecast_miss_peak: max(Map.get(m, :forecast_miss_peak, 0), forecast_miss),
        month_bench_spend: m.month_bench_spend + max(0, bench_cost_total(w) - m.bench_cost_prev),
        customer_mood_peak: max(m.customer_mood_peak, w.customer_mood || 0.55),
        customer_mood_min: min(m.customer_mood_min, w.customer_mood || 0.55),
        team_prediction_miss_peak: max(Map.get(m, :team_prediction_miss_peak, 0), team_prediction_miss(w)),
        prev_feature_sum: total_feat,
        feature_velocity: feature_velocity,
        lead_time: lead_time,
        ticks: m.ticks + 1
    }

    w = %{w | tick: w.tick + 1, metrics: m}

    if w.tick > 0 and rem(w.tick, @month_ticks) == 0 do
      close_sim_month(w, w.metrics.month_bench_spend)
    else
      %{w | metrics: %{w.metrics | bench_cost_prev: bench_cost_total(w)}}
    end
  end

  defp init_metrics do
    %{
      tasks_consumed: 0,
      tasks_spawned: 0,
      features_built: 0,
      debt_accrued: 0.0,
      debt_paid: 0.0,
      debt_weight_peak: 0.0,
      month_bench_spend: 0.0,
      bench_cost_prev: 0.0,
      months_closed: 0,
      months_over_budget: 0,
      month_spend_peak: 0.0,
      customer_mood_peak: 0.55,
      customer_mood_min: 0.55,
      debt_generated: 0,
      billable_h: 0.0,
      collab_events: 0,
      incidents: 0,
      peak_task: 0,
      peak_debt: 0,
      feature_sum: 0,
      hyphae_sum: 0,
      consumer_peak: 0,
      leads_sum: 0,
      forecast_miss_peak: 0,
      surprise_events: 0,
      psych_drift: 0,
      operative_eur: 0.0,
      strategic_eur: 0.0,
      strategic_in_house: 0.0,
      strategic_market: 0.0,
      prev_consumers: 0,
      prev_leads: 0.0,
      prev_bench_cost: 0.0,
      consumer_vel: 0.0,
      lead_vel: 0.0,
      bench_vel: 0.0,
      intelligence_peak: 0.0,
      team_prediction_miss_peak: 0.0,
      prediction_error_peak: 0.0,
      prediction_error_sum: 0.0,
      prediction_error_avg: 0.0,
      prediction_scores: 0,
      month_pred_snap: nil,
      change_attempts: 0,
      recovery_ticks_remaining: 0,
      current_incident_mttr: 0,
      recovery_ticks_total: 0.0,
      incidents_resolved: 0,
      recovery_penalty: 1.0,
      prev_feature_sum: 0.0,
      feature_velocity: 0.0,
      lead_time: 0.0,
      bench_month_history: [],
      iq_over_outside_sum: 0.0,
      iq_over_outside_scores: 0,
      iq_over_outside_avg: 0.0,
      outside_view_error_avg: 0.0,
      ticks: 0
    }
  end

  defp is_tail_scenario?(w) do
    w.pattern in [:nobody, :everybody] or w.usage >= 1.05 or
      (w.market == :volatile and (w.metrics.forecast_miss_peak || 0) > 0.7)
  end

  defp is_operating_band?(w) do
    w.usage >= 0.55 and w.usage <= 0.92 and w.pattern not in [:nobody, :everybody]
  end

  defp bounded_concurrency_pattern?(pattern) do
    pattern in [
      :cce, :pair, :work_stealing, :swarm_blockers, :least_loaded,
      :round_robin, :set_based, :solo_serial
    ]
  end

  defp flow_stationarity_factor(w, t) do
    recovery = Map.get(w.metrics, :recovery_ticks_remaining, 0) > 0
    miss = t.forecast_miss || w.metrics.forecast_miss_peak || 0

    cond do
      recovery -> 0.5
      little_law_stable?(w) -> 1.0
      miss < 0.9 -> 0.88
      miss < 2.0 -> 0.72
      miss < 3.5 -> 0.58
      true -> 0.45
    end
  end

  defp flow_velocity_factor(v) do
    cond do
      v >= 0.08 -> 1.0
      v >= 0.03 -> 0.88
      v >= 0.012 -> 0.72
      v >= 0.004 -> 0.55
      true -> 0.35
    end
  end

  defp flow_lead_factor(t) do
    throughput = max(t.feature_velocity, 0.006)
    wip = max(t.task_backlog, 1.0)
    drain = wip / (throughput * 320)

    cond do
      drain < 2.5 -> 1.0
      drain < 6.0 -> 0.82
      drain < 12.0 -> 0.62
      true -> 0.4
    end
  end

  defp product_health(w, t) do
    burn_ratio = (w.metrics.month_bench_spend || 0) / max(w.monthly_red_line, 1)
    paid_ratio = (w.metrics.debt_paid || 0) / max(w.metrics.debt_accrued || 0, 1)
    mood = t.customer_mood
    months_over = w.metrics.months_over_budget || 0

    service =
      min(1.0, max(0.0,
        (cond do
           mood >= 0.72 -> 1.0
           mood >= 0.58 -> 0.8
           mood >= 0.42 -> 0.5
           true -> 0.15
         end) *
          (cond do
             burn_ratio <= 0.78 -> 1.0
             burn_ratio <= 1.0 -> 0.6
             true -> 0.25
           end) *
          if(months_over == 0, do: 1.0, else: 0.65)
      ))

    ecology =
      min(1.0, max(0.0,
        (if t.quality >= 0.04, do: min(1.0, t.quality * 11), else: 0.12) *
          (1.0 - min(0.78, t.debt_weight * 0.82)) *
          if(paid_ratio > 0.015 or t.debt_weight < 0.52, do: 1.0, else: 0.72)
      ))

    flow =
      min(1.0, max(0.0,
        flow_stationarity_factor(w, t) *
          flow_velocity_factor(t.feature_velocity) *
          flow_lead_factor(t)
      ))

    bounded = bounded_concurrency_pattern?(w.pattern)

    team =
      min(1.0, max(0.0,
        (if bounded, do: 0.92, else: 0.12) *
          (1.0 - min(1.0, t.psych / 1.25)) *
          (cond do
             t.avg_morale >= 0.52 -> 1.0
             t.avg_morale >= 0.42 -> 0.78
             true -> 0.5
           end) *
          (cond do
             t.hyphae_mass > 120 -> 1.0
             t.hyphae_mass > 40 -> 0.72
             true -> 0.45
           end) *
          (cond do
             t.avg_experience >= 0.42 -> 1.0
             t.avg_experience >= 0.32 -> 0.75
             true -> 0.55
           end)
      ))

    reliability =
      min(1.0, max(0.0,
        (1.0 - min(1.0, t.synthetic_cfr / 0.22)) *
          (if t.mttr_avg <= 14 or t.surprise_events == 0, do: 1.0,
             else: if(t.mttr_avg <= 22, do: 0.78, else: 0.48)) *
          if(t.recovery_active, do: 0.5, else: 1.0)
      ))

    learning =
      min(1.0, max(0.0,
        (1.0 - min(1.0, t.prediction_error_avg / 0.82)) *
          (cond do
             t.prediction_intelligence >= 0.52 -> 1.0
             t.prediction_intelligence >= 0.36 -> 0.78
             true -> 0.55
           end) *
          if(t.iq_over_outside >= 0.25 or Map.get(t, :iq_over_outside_scores, 0) < 2, do: 1.0, else: 0.72)
      ))

    lanes = %{
      service: Float.round(service, 3),
      ecology: Float.round(ecology, 3),
      flow: Float.round(flow, 3),
      team: Float.round(team, 3),
      reliability: Float.round(reliability, 3),
      learning: Float.round(learning, 3)
    }

    index =
      service * 0.22 + ecology * 0.2 + flow * 0.16 + team * 0.18 + reliability * 0.12 +
        learning * 0.12

    tail = is_tail_scenario?(w)

    label =
      cond do
        tail -> "tail — rare stress"
        index >= 0.64 and service >= 0.5 and ecology >= 0.38 and flow >= 0.32 -> "healthy"
        index >= 0.52 -> "guarded"
        index >= 0.36 -> "stressed"
        true -> "critical"
      end

  %{
    index: Float.round(index, 3),
    label: label,
    lanes: lanes,
    tail: tail,
    operating: is_operating_band?(w),
    service_fulfilled: service >= 0.5 and mood >= 0.42,
    concurrency_ok: team >= 0.48 and bounded,
    contrast_ready: t.hyphae_mass > 120 and (w.pattern == :set_based or t.avg_experience >= 0.45)
  }
  end

  defp finalize(w) do
    billable =
      Enum.reduce(w.agents, 0.0, fn a, s ->
        b = if is_number(a.billable), do: a.billable * 1.0, else: 0.0
        s + b
      end)

    cost = bench_cost_total(w)
    total_task = grid_sum(w.task)
    total_debt = grid_sum(w.debt)
    total_feat = grid_sum(w.feature)
    total_hy = grid_sum(w.hyphae)
    consumers = Enum.count(w.agents, &(&1.kind == :consumer))

    quality =
      if total_feat + total_debt > 0,
        do: total_feat / (total_feat + total_debt * 1.2) * 1.0,
        else: 0.0

    stability = max(0.0, 1.0 - total_debt / max(total_feat, 1) / 80) * 1.0
    operative = w.metrics.operative_eur
    strategic = w.metrics.strategic_eur
    total_cost = cost + operative + strategic
    velocity = total_feat / max(@ticks, 1)
    psych = coordination_stress(w.pattern, w.agents) + Map.get(w.metrics, :psych_drift, 0)
    security = debt_fog(w) * w.usage
    avg_exp = avg_experience(w.agents)
    avg_mor = avg_morale(w.agents)
    skill_gap = max(0.0, market_skill_index(w.market) - avg_exp)

    forecast_miss = Float.round(w.metrics.forecast_miss_peak, 3)

    debt_weight_final = Float.round(debt_weight(w), 3)
    mood = Float.round(w.customer_mood || 0.55, 3)
    iq = Float.round(w.prediction_intelligence || 0.38, 3)
    pred_err = Float.round(Map.get(w.metrics, :prediction_error_avg, 0), 3)
    team_miss = Float.round(Map.get(w.metrics, :team_prediction_miss_peak, 0), 3)
    change_attempts = Map.get(w.metrics, :change_attempts, 0)
    synthetic_cfr = Float.round(min(1.0, w.metrics.surprise_events / max(change_attempts, 1)), 3)
    incidents_resolved = Map.get(w.metrics, :incidents_resolved, 0)
    mttr_avg = Float.round(Map.get(w.metrics, :recovery_ticks_total, 0) / max(incidents_resolved, 1), 1)
    feature_velocity = Float.round(Map.get(w.metrics, :feature_velocity, 0), 1)
    lead_time = Float.round(Map.get(w.metrics, :lead_time, 0), 1)
    recovery_active = Map.get(w.metrics, :recovery_ticks_remaining, 0) > 0
    little_law_stable = little_law_stable?(w)
    iq_outside = Float.round(Map.get(w.metrics, :iq_over_outside_avg, 0), 3)
    outside_err_avg = Float.round(Map.get(w.metrics, :outside_view_error_avg, 0), 3)
    iq_scores = Map.get(w.metrics, :iq_over_outside_scores, 0)

    base = %{
      pattern: w.pattern,
      usage: w.usage,
      market: w.market,
      investment: w.investment,
      marketing: w.marketing,
      dev_rate: w.dev_rate,
      consultant_rate: w.consultant_rate,
      monthly_red_line: w.monthly_red_line,
      customer_mood: mood,
      customer_mood_label: customer_mood_label(mood),
      months_over_budget: w.metrics.months_over_budget,
      month_spend_peak: Float.round(w.metrics.month_spend_peak, 0),
      prediction_intelligence: iq,
      intelligence_peak: Float.round(Map.get(w.metrics, :intelligence_peak, iq), 3),
      pred_leads: Float.round(w.pred_leads || 0, 1),
      pred_consumers: Float.round(w.pred_consumers || 0, 1),
      pred_bench_month: Float.round(w.pred_bench_month || 0, 0),
      pred_market: w.pred_market,
      team_prediction_miss: team_miss,
      prediction_error_avg: pred_err,
      prediction_error_peak: Float.round(Map.get(w.metrics, :prediction_error_peak, 0), 3),
      triple: format_triple(@ticks / max(velocity, 0.01) / 40, total_cost, quality),
      cost_eur: Float.round(cost, 0),
      operative_eur: Float.round(operative, 0),
      strategic_eur: Float.round(strategic, 0),
      total_cost_eur: Float.round(total_cost, 0),
      billable_h: Float.round(billable, 1),
      feature_mass: total_feat,
      task_backlog: total_task,
      debt_mass: total_debt,
      debt_accrued: Float.round(w.metrics.debt_accrued, 0),
      debt_paid: Float.round(w.metrics.debt_paid, 0),
      debt_weight: debt_weight_final,
      hyphae_mass: total_hy,
      consumers: consumers,
      leads_final: Float.round(w.leads * 1.0, 1),
      forecast_miss: forecast_miss,
      surprise_events: w.metrics.surprise_events,
      change_attempts: change_attempts,
      synthetic_cfr: synthetic_cfr,
      mttr_avg: mttr_avg,
      feature_velocity: feature_velocity,
      lead_time: lead_time,
      recovery_active: recovery_active,
      little_law_stable: little_law_stable,
      iq_over_outside: iq_outside,
      iq_over_outside_scores: iq_scores,
      outside_view_error_avg: outside_err_avg,
      recent_events: w.events,
      avg_experience: Float.round(avg_exp, 3),
      avg_morale: Float.round(avg_mor, 3),
      skill_gap: Float.round(skill_gap, 3),
      quality: Float.round(quality, 3),
      stability: Float.round(stability, 3),
      psych: Float.round(min(1.5, psych), 3),
      security: Float.round(security, 3),
      peak_task: w.metrics.peak_task,
      peak_debt: w.metrics.peak_debt,
      score: Float.round(composite(quality, stability, total_cost, psych, avg_mor, avg_exp, mood, iq, pred_err), 3)
    }

    Map.put(base, :health, product_health(w, base))
  end

  defp aggregate_psychology(results) do
    results
    |> Enum.group_by(fn r -> {r.dev_rate, r.monthly_red_line} end)
    |> Enum.map(fn {{dev_rate, red_line}, rows} ->
      row = hd(rows)

      %{
        dev_rate: dev_rate,
        consultant_rate: row.consultant_rate,
        monthly_red_line: red_line,
        cost_eur: Float.round(row.cost_eur, 0),
        customer_mood: row.customer_mood,
        customer_mood_label: row.customer_mood_label,
        months_over_budget: row.months_over_budget,
        month_spend_peak: row.month_spend_peak,
        score: row.score
      }
    end)
    |> Enum.sort_by(fn r -> {r.dev_rate, r.monthly_red_line} end)
  end

  defp debt_fog(w), do: min(1.0, grid_sum(w.debt) / (w.w * w.h * 60))

  defp coordination_stress(pattern, agents) do
    devs = Enum.filter(agents, &(&1.kind in [:dev, :consultant]))
    n = length(devs)

    overlap =
      Enum.count(devs, fn a ->
        Enum.any?(devs, fn b ->
          b.id != a.id and abs(a.x - b.x) <= 1 and abs(a.y - b.y) <= 1
        end)
      end)

    base =
      case pattern do
        :everybody -> brooks_channel_stress(n) + 0.15
        :swarm_blockers -> 0.55
        :cce -> 0.32
        :pair -> 0.35
        :solo_serial -> 0.1
        _ -> 0.25
      end

    base + overlap / max(n, 1) * 0.15
  end

  defp brooks_channel_stress(n) when n < 2, do: 0.0
  defp brooks_channel_stress(n), do: n * (n - 1) / (2.0 * 36.0)

  defp little_law_stable?(w) do
    rem = Map.get(w.metrics, :recovery_ticks_remaining, 0)
    miss = Map.get(w.metrics, :forecast_miss_peak, 0)

    miss < 0.55 and rem <= 0 and w.market != :volatile
  end

  defp composite(quality, stability, total_cost, psych, morale, experience, customer_mood, intelligence, pred_err) do
    pred_bonus = max(0.0, 1.0 - min(1.0, pred_err))

    0.16 * quality + 0.14 * stability + 0.12 * (1.0 / max(total_cost / 80_000, 0.1)) +
      0.1 * (1.0 - min(1.0, psych)) + 0.1 * morale + 0.08 * experience + 0.14 * customer_mood +
      0.1 * intelligence + 0.06 * pred_bonus
    |> min(1.0)
  end

  defp format_triple(tv, cost, quality) do
    q = if quality >= 0.55, do: "high", else: if(quality >= 0.35, do: "medium", else: "low")
    "<#{Float.round(tv, 1)}h, €#{Float.round(cost, 0)}, #{q}>"
  end

  # pattern modifiers
  defp pattern_efficiency(:solo_serial, _), do: 1.0
  defp pattern_efficiency(:work_stealing, _), do: 1.08
  defp pattern_efficiency(:pair, _), do: 0.95
  defp pattern_efficiency(:swarm_blockers, _), do: 0.88
  defp pattern_efficiency(:everybody, _), do: 0.72
  defp pattern_efficiency(:cce, _), do: 1.02
  defp pattern_efficiency(:nobody, _), do: 0
  defp pattern_efficiency(_, :consultant), do: 0.65
  defp pattern_efficiency(_, _), do: 0.92

  defp pattern_scope(:everybody), do: 1.8
  defp pattern_scope(:consultant), do: 2.0
  defp pattern_scope(:set_based), do: 1.3
  defp pattern_scope(_), do: 1.0

  defp pattern_hyphae(:pair), do: 1.4
  defp pattern_hyphae(:work_stealing), do: 1.2
  defp pattern_hyphae(:swarm_blockers), do: 1.1
  defp pattern_hyphae(:solo_serial), do: 0.5
  defp pattern_hyphae(:everybody), do: 0.7
  defp pattern_hyphae(:cce), do: 1.15
  defp pattern_hyphae(_), do: 0.9

  defp cce_hyphae_mult(:solo_serial), do: 0.5
  defp cce_hyphae_mult(:least_loaded), do: 0.85
  defp cce_hyphae_mult(:work_stealing), do: 1.2
  defp cce_hyphae_mult(:pair), do: 1.4
  defp cce_hyphae_mult(:swarm_blockers), do: 1.1
  defp cce_hyphae_mult(:set_based), do: 1.0
  defp cce_hyphae_mult(_), do: 0.9

  defp cce_scope_mult(:set_based), do: 1.3
  defp cce_scope_mult(:pair), do: 1.1
  defp cce_scope_mult(:swarm_blockers), do: 1.2
  defp cce_scope_mult(_), do: 1.0

  defp pattern_participants(w, a) do
    case w.pattern do
      :cce ->
        cce_participants(w, a)

      :pair ->
        if a.kind == :dev and nearby_devs?(w, a), do: 2.0, else: 1.0

      :swarm_blockers ->
        n = Enum.count(w.agents, fn o -> o.kind == :dev and abs(o.x - a.x) <= 2 end)
        min(4.0, 1.0 + n * 0.5)

      :everybody ->
        6.0

      :set_based ->
        3.0

      _ ->
        1.0
    end
  end

  defp cce_participants(w, a) do
    case cce_mode(w, a) do
      :pair ->
        if a.kind == :dev and nearby_devs?(w, a), do: 2.0, else: 1.0

      :swarm_blockers ->
        n = Enum.count(w.agents, fn o -> o.kind == :dev and abs(o.x - a.x) <= 2 end)
        min(4.0, 1.0 + n * 0.5)

      :set_based ->
        3.0

      _ ->
        1.0
    end
  end

  defp aggregate_climate(results) do
    results
    |> Enum.group_by(fn r -> {r.market, r.investment, r.marketing} end)
    |> Enum.map(fn {{market, investment, marketing}, rows} ->
      avg = fn key, prec ->
        vals = Enum.map(rows, &Map.get(&1, key))
        nums = Enum.map(vals, fn v -> if is_number(v), do: v * 1.0, else: 0.0 end)
        Float.round(Enum.sum(nums) / max(length(nums), 1), prec)
      end

      %{
        market: market,
        investment: investment,
        marketing: marketing,
        cost_eur: avg.(:cost_eur, 0),
        operative_eur: avg.(:operative_eur, 0),
        strategic_eur: avg.(:strategic_eur, 0),
        total_cost_eur: avg.(:total_cost_eur, 0),
        avg_experience: avg.(:avg_experience, 3),
        avg_morale: avg.(:avg_morale, 3),
        debt_mass: avg.(:debt_mass, 0),
        feature_mass: avg.(:feature_mass, 0),
        forecast_miss: avg.(:forecast_miss, 3),
        surprise_events: avg.(:surprise_events, 1),
        score: avg.(:score, 3)
      }
    end)
    |> Enum.sort_by(fn r -> {r.market, r.investment, r.marketing} end)
  end

  defp aggregate(results) do
    results
    |> Enum.group_by(fn r -> {r.pattern, r.usage} end)
    |> Enum.map(fn {{pattern, usage}, rows} ->
      avg = fn key, prec ->
        vals = Enum.map(rows, &Map.get(&1, key))
        nums = Enum.map(vals, fn v -> if is_number(v), do: v * 1.0, else: 0.0 end)
        Float.round(Enum.sum(nums) / max(length(nums), 1), prec)
      end

      %{
        pattern: pattern,
        usage: usage,
        runs: length(rows),
        triple: most_common(Enum.map(rows, & &1.triple)),
        cost_eur: avg.(:cost_eur, 0),
        operative_eur: avg.(:operative_eur, 0),
        strategic_eur: avg.(:strategic_eur, 0),
        total_cost_eur: avg.(:total_cost_eur, 0),
        billable_h: avg.(:billable_h, 1),
        feature_mass: avg.(:feature_mass, 0),
        task_backlog: avg.(:task_backlog, 0),
        debt_mass: avg.(:debt_mass, 0),
        debt_paid: avg.(:debt_paid, 0),
        debt_accrued: avg.(:debt_accrued, 0),
        debt_weight: avg.(:debt_weight, 3),
        hyphae_mass: avg.(:hyphae_mass, 0),
        avg_experience: avg.(:avg_experience, 3),
        avg_morale: avg.(:avg_morale, 3),
        quality: avg.(:quality, 3),
        stability: avg.(:stability, 3),
        psych: avg.(:psych, 3),
        security: avg.(:security, 3),
        peak_debt: avg.(:peak_debt, 0),
        prediction_intelligence: avg.(:prediction_intelligence, 3),
        prediction_error_avg: avg.(:prediction_error_avg, 3),
        team_prediction_miss: avg.(:team_prediction_miss, 3),
        feature_velocity: avg.(:feature_velocity, 1),
        lead_time: avg.(:lead_time, 1),
        synthetic_cfr: avg.(:synthetic_cfr, 3),
        mttr_avg: avg.(:mttr_avg, 1),
        change_attempts: avg.(:change_attempts, 0),
        iq_over_outside: avg.(:iq_over_outside, 3),
        outside_view_error_avg: avg.(:outside_view_error_avg, 3),
        little_law_stable: Enum.count(rows, &Map.get(&1, :little_law_stable, false)) > div(length(rows), 2),
        health_index: avg_health_index(rows),
        health_label: most_common(Enum.map(rows, fn r -> get_in(r, [:health, :label]) || "—" end)),
        pred_market: most_common(Enum.map(rows, & &1.pred_market)) |> to_string(),
        score: avg.(:score, 3)
      }
    end)
    |> Enum.sort_by(fn r -> {r.pattern, r.usage} end)
  end

  defp avg_health_index(rows) do
    vals =
      Enum.map(rows, fn r ->
        case Map.get(r, :health) do
          %{index: idx} when is_number(idx) -> idx
          _ -> 0.0
        end
      end)

    Float.round(Enum.sum(vals) / max(length(vals), 1), 3)
  end

  defp most_common(list) do
    list
    |> Enum.frequencies()
    |> Enum.max_by(fn {_, c} -> c end)
    |> elem(0)
  end

  defp snapshot_extremes(results) do
    u07 = Enum.filter(results, &(&1.usage == 0.7))

    %{
      nobody: Enum.find(results, &(&1.pattern == :nobody and &1.usage == 0.7)),
      debt_explosion:
        u07
        |> Enum.max_by(& &1.debt_mass),
      feature_leader:
        u07
        |> Enum.max_by(& &1.feature_mass),
      cost_leader:
        u07
        |> Enum.max_by(& &1.total_cost_eur),
      hyphae_leader:
        u07
        |> Enum.max_by(& &1.hyphae_mass)
    }
  end

  defp lifecycle_sample(pattern, usage) do
    world = init_world(pattern, usage)

    tick_all = fn acc ->
      acc
      |> tick_recovery()
      |> tick_market_drift()
      |> tick_marketing()
      |> tick_lead_conversion()
      |> tick_random_events()
      |> tick_feedback()
      |> tick_consumers()
      |> tick_agents()
      |> tick_people()
      |> tick_costs()
      |> tick_hyphae_life()
      |> tick_debt_ecology()
    end

    samples =
      [0, 50, 100, 170, 230, @ticks - 1]
      |> Enum.map(fn t ->
        w =
          if t == 0 do
            world
          else
            Enum.reduce(1..t, world, fn _, acc -> tick_all.(acc) end)
          end

        %{
          tick: t,
          feature: grid_sum(w.feature),
          task: grid_sum(w.task),
          debt: grid_sum(w.debt),
          hyphae: grid_sum(w.hyphae),
          consumers: Enum.count(w.agents, &(&1.kind == :consumer)),
          leads: Float.round(w.leads * 1.0, 1),
          market: w.market,
          experience: Float.round(avg_experience(w.agents), 3),
          morale: Float.round(avg_morale(w.agents), 3)
        }
      end)

    %{pattern: pattern, usage: usage, samples: samples}
  end

  def report(data) do
    IO.puts("\n=== SHARED BENCH ECOSYSTEM SIMULATION ===\n")
    c = data.config
    IO.puts("Grid #{c.grid} · #{c.ticks} ticks · #{c.devs} devs · #{c.consultants} consultants · P=€#{c.p}/h\n")

    IO.puts("--- EXTREMES (usage 0.7) ---")
    e = data.snapshots
    print_snap = fn label, r ->
      if r do
        IO.puts("#{label}: #{r.triple} debt=#{trunc(r.debt_mass)} feature=#{trunc(r.feature_mass)} hyphae=#{trunc(r.hyphae_mass)}")
      end
    end

    print_snap.("nobody", e.nobody)
    print_snap.("debt explosion", e.debt_explosion)
    print_snap.("feature leader", e.feature_leader)
    print_snap.("cost leader", e.cost_leader)
    print_snap.("hyphae/collab leader", e.hyphae_leader)

    IO.puts("\n--- LIFECYCLE (work_stealing, usage 0.7) ---")
    for s <- data.lifecycle.samples do
      IO.puts("t=#{String.pad_leading("#{s.tick}", 3)} feature=#{s.feature} task=#{s.task} debt=#{s.debt} hyphae=#{s.hyphae} consumers=#{s.consumers}")
    end

    IO.puts("\n--- PATTERNS AT usage=0.7 (avg of 4 runs) ---")
    data.aggregates
    |> Enum.filter(&(&1.usage == 0.7))
    |> Enum.sort_by(& &1.score, :desc)
    |> Enum.each(fn r ->
      IO.puts(
        "#{pad(r.pattern, 18)} #{r.triple}  total=€#{trunc(r.total_cost_eur)}  bench=€#{trunc(r.cost_eur)}  opex=€#{trunc(r.operative_eur)}  exp=#{r.avg_experience}  mor=#{r.avg_morale}  score=#{r.score}"
      )
    end)

    IO.puts("\n--- PREDICTION INTELLIGENCE (usage 0.7) ---")
    data.aggregates
    |> Enum.filter(&(&1.usage == 0.7))
    |> Enum.sort_by(& &1.prediction_intelligence, :desc)
    |> Enum.take(6)
    |> Enum.each(fn r ->
      IO.puts(
        "#{pad(r.pattern, 18)} IQ=#{r.prediction_intelligence} err=#{r.prediction_error_avg} team_miss=#{r.team_prediction_miss} pred_mkt=#{r.pred_market}"
      )
    end)

    IO.puts("\n--- USAGE GROWTH (work_stealing) ---")
    data.aggregates
    |> Enum.filter(&(&1.pattern == :work_stealing))
    |> Enum.each(fn r ->
      IO.puts("usage=#{r.usage}  #{r.triple}  debt=#{trunc(r.debt_mass)}  backlog=#{trunc(r.task_backlog)}")
    end)

    IO.puts("\n--- CONSULTANT EFFECT (usage 0.9) ---")
    for pat <- [:solo_serial, :everybody, :cce] do
      row = Enum.find(data.aggregates, &(&1.pattern == pat and &1.usage == 0.9))
      if row, do: IO.puts("#{pad(pat, 18)} #{row.triple} cost=€#{trunc(row.cost_eur)} debt=#{trunc(row.debt_mass)}")
    end

    if data.climate do
      IO.puts("\n--- MARKET / INVESTMENT / MARKETING (work_stealing, usage 0.7) ---")
      data.climate
      |> Enum.sort_by(& &1.score, :desc)
      |> Enum.take(8)
      |> Enum.each(fn r ->
        IO.puts(
          "#{pad(r.market, 10)} #{pad(r.investment, 8)} mkt=#{r.marketing}  cost=€#{trunc(r.cost_eur)}  debt=#{trunc(r.debt_mass)}  miss=#{r.forecast_miss}  events=#{trunc(r.surprise_events)}  score=#{r.score}"
        )
      end)
    end

    if data.psychology do
      IO.puts("\n--- CUSTOMER PSYCHOLOGY (work_stealing, usage 0.7) ---")
      data.psychology
      |> Enum.sort_by(&{&1.customer_mood, &1.score}, :desc)
      |> Enum.each(fn r ->
        IO.puts(
          "dev=€#{trunc(r.dev_rate)} red=€#{trunc(r.monthly_red_line)}  bench=€#{trunc(r.cost_eur)}  mood=#{r.customer_mood} #{r.customer_mood_label}  months_over=#{r.months_over_budget}  peak_month=€#{trunc(r.month_spend_peak)}"
        )
      end)
    end

    :ok
  end

  defp pad(atom, n) do
    s = to_string(atom)
    if String.length(s) >= n, do: s, else: s <> String.duplicate(" ", n - String.length(s))
  end
end

defmodule BenchJSON do
  def encode!(data) do
    ag =
      data.aggregates
      |> Enum.map(fn r ->
        ~s({"pattern":"#{r.pattern}","usage":#{r.usage},"triple":"#{r.triple}","cost_eur":#{r.cost_eur},"operative_eur":#{r.operative_eur},"strategic_eur":#{r.strategic_eur},"total_cost_eur":#{r.total_cost_eur},"billable_h":#{r.billable_h},"feature_mass":#{r.feature_mass},"task_backlog":#{r.task_backlog},"debt_mass":#{r.debt_mass},"debt_paid":#{r.debt_paid},"debt_accrued":#{r.debt_accrued},"debt_weight":#{r.debt_weight},"hyphae_mass":#{r.hyphae_mass},"avg_experience":#{r.avg_experience},"avg_morale":#{r.avg_morale},"quality":#{r.quality},"stability":#{r.stability},"psych":#{r.psych},"security":#{r.security},"feature_velocity":#{r.feature_velocity},"lead_time":#{r.lead_time},"little_law_stable":#{r.little_law_stable},"synthetic_cfr":#{r.synthetic_cfr},"mttr_avg":#{r.mttr_avg},"change_attempts":#{r.change_attempts},"iq_over_outside":#{r.iq_over_outside},"outside_view_error_avg":#{r.outside_view_error_avg},"score":#{r.score}})
      end)
      |> Enum.join(",")

    lc =
      data.lifecycle.samples
      |> Enum.map(fn s ->
        ~s({"tick":#{s.tick},"feature":#{s.feature},"task":#{s.task},"debt":#{s.debt},"hyphae":#{s.hyphae},"consumers":#{s.consumers},"leads":#{s.leads},"market":"#{s.market}","experience":#{s.experience},"morale":#{s.morale}})
      end)
      |> Enum.join(",")

    cl =
      (data.climate || [])
      |> Enum.map(fn r ->
        ~s({"market":"#{r.market}","investment":"#{r.investment}","marketing":#{r.marketing},"cost_eur":#{r.cost_eur},"debt_mass":#{r.debt_mass},"feature_mass":#{r.feature_mass},"forecast_miss":#{r.forecast_miss},"surprise_events":#{r.surprise_events},"score":#{r.score}})
      end)
      |> Enum.join(",")

    psych =
      (data.psychology || [])
      |> Enum.map(fn r ->
        ~s({"dev_rate":#{r.dev_rate},"consultant_rate":#{r.consultant_rate},"monthly_red_line":#{r.monthly_red_line},"cost_eur":#{r.cost_eur},"customer_mood":#{r.customer_mood},"customer_mood_label":"#{r.customer_mood_label}","months_over_budget":#{r.months_over_budget},"month_spend_peak":#{r.month_spend_peak},"score":#{r.score}})
      end)
      |> Enum.join(",")

    ~s({"config":#{config_json(data.config)},"aggregates":[#{ag}],"climate":[#{cl}],"psychology":[#{psych}],"lifecycle":{"pattern":"cce","usage":0.7,"samples":[#{lc}]}})
  end

  defp config_json(c) do
    ~s({"grid":"#{c.grid}","ticks":#{c.ticks},"devs":#{c.devs},"consultants":#{c.consultants},"p":#{c.p},"q":#{c.q}})
  end
end

data = SharedBench.Ecosystem.run()
SharedBench.Ecosystem.report(data)
path = Path.join(__DIR__, "simulation_results.json")
File.write!(path, BenchJSON.encode!(data))
IO.puts("\nJSON → #{path}")
