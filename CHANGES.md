# Changes from PSM1 Proposal

Log of differences between the FYP1 proposal (PSM1) and the FYP2 implementation.
Used to update Chapter 3 and explain changes in Chapter 4.

| # | Date | Change | Reason | Proposal section affected |
|---|------|--------|--------|---------------------------|
| 1 | 2026-11-11 | Controllers merged into route files; services kept separate (ML, SHAP, LLM). | Removes duplicate files for the same job; simpler to maintain. | 3.8.2, Figure 3.23 |
| 2 | 2026-11-11 | All 7 database tables defined in one `models.py`. | Small schema; one file is easier to follow. | 3.8.2, Figure 3.23 |
| 3 | 2026-11-11 | React frontend built with Vite instead of Create React App. | Create React App is deprecated; Vite is the current standard and still React. | 3.8.3, Figure 3.24 |
| 4 | 2026-11-11 | No `utils` folder; BMI calculation placed where it is used. | BMI is a one-line formula; a separate folder is unnecessary. | 3.8.2, Figure 3.23 |
| 5 | 2026-11-11 | `requirements.txt` lists only direct dependencies. | Easier to read and install; sub-dependencies install automatically. | 3.8.1 |
