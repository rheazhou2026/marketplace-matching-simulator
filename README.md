# Learning to Match: A Sequential Marketplace Simulator

An interactive, **dependency-free** browser simulation of rider–driver dispatch, based on Rhea Zhou's *Learning to Match: Uber's Sequential Marketplace Optimization Problem*.

[Open the interactive simulator](https://rheazhou2026.github.io/marketplace-matching-simulator/)

## What this demonstrates

- **LCAM — Learned-Cost Assignment Matrix:** construct a synthetic immediate pair cost from pickup distance, cancellation-risk proxy, rider wait, and trip distance; find a globally optimal one-to-one bipartite assignment for that batch with an exact dynamic-programming solver.
- **DVAM — Dynamic Value-Augmented Matching:** change the pair cost to `immediate_cost - lambda × (V(destination_zone) - 0.25 × V(current_zone))`. The zone-value estimates update with a simplified TD(0)-style bootstrap: `V[z] += 0.13 × (demand_supply_proxy[z] + 0.82 × V[next_zone] - V[z])`.
- **Marketplace feedback:** drivers become unavailable while completing rides, reappear at trip destinations, and change subsequent supply distributions. Riders arrive over time and cancel after synthetic patience thresholds.
- **Controlled comparisons:** both policies see identical seeded incoming requests. Different decisions cause different state trajectories. Change seed and future-value weight λ; inspect matched trips, completed trips, cancellations, pickup times, and fulfillment.

> **Scientific limitations:** The feature weights, spatial demand, travel times, acceptance/cancellation proxies, and temporal-difference updates are illustrative—not trained from real data. The DP algorithm is an exact solver for the *small synthetic batch*, not a large-scale dispatch algorithm. DVAM is **Bellman-inspired**, not a reproduction of Uber's production reinforcement-learning model, nor a validation of the real-world figures cited in the paper. A future-aware policy may perform worse than LCAM. Results are not causal estimates of Uber outcomes.

## Run locally

A static server is recommended because the app uses JavaScript ES modules:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Or use VS Code Live Server. No npm install required.

## Tests

```bash
node --test engine.test.mjs
```

Includes deterministic event generation, exact assignment constraints, marketplace accounting invariants, and the zero-future-weight equivalence check.

## Publish on GitHub Pages

1. Create a new **public** GitHub repository named `marketplace-matching-simulator` under `rheazhou2026`.
2. Upload all files in this folder to the **root** of its `main` branch (or push the Git repository with `git push`).
3. Go to **Settings → Pages → Build and deployment**, select **Deploy from a branch**, `main`, `/ (root)` and save.
4. Once deployed, the demo will be at https://rheazhou2026.github.io/marketplace-matching-simulator/ .

## Files

- `index.html` — accessible controls, canvas maps, metrics and explanatory notes
- `styles.css` — responsive dark dashboard
- `app.mjs` — interactive rendering and playback
- `engine.mjs` — seeded arrival stream, dispatch logic, TD-inspired value update, exact bipartite assignment
- `engine.test.mjs` — simulation correctness checks

## Research basis

See the accompanying original 3-page PDF for the LCAM/DVAM formulations and citations to Uber Engineering, Sutton (1988), Xu et al. (2018), Qin et al. (2020), and Alonso-Mora et al. (2017).

**Author:** Rhea Zhou · University of Pennsylvania, M&T '30. Independent educational project; no affiliation with Uber.
