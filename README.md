# Guardia Planning App

This repository contains a simple web application that helps four residents
plan their guardia (on‑call) shifts. Each resident must select a certain
number of shifts (four in the example) from a predefined list of dates.
Shifts may be of two types: **Puerta** (door) or **Traumato** (trauma). The
application highlights conflicts when more than one resident selects the same
shift and provides a button to automatically resolve those conflicts in a
fair manner.

## Features

- **Resident selection:** Choose your name from a drop‑down menu to start
  planning your shifts.
- **Shift table:** View all available guardia dates and their types in a
  tabular format. Each row shows the assigned residents (if any) and
  includes a checkbox for the current resident to claim that slot.
- **Conflict detection:** Rows with more than one resident assigned are
  highlighted in red so you can easily see scheduling conflicts.
- **Fair conflict resolution:** After all residents have made their picks,
  click **Resolve conflicts** to automatically assign contested shifts to
  the resident who currently has the fewest total assignments. Ties are
  broken by the order in which residents selected the shift.

## Running Locally

No build step is required—this is a static site. To run the app locally:

1. Clone this repository to your machine.
2. Open `index.html` in your favourite web browser. The planning interface
   should load immediately.

## Deploying to Vercel

1. Create a new GitHub repository and push the contents of this folder to it.
2. Sign in to [Vercel](https://vercel.com/) and click **New Project**.
3. Import your GitHub repository. Vercel will detect that this is a static
   site and will automatically configure the deployment.
4. Click **Deploy**. Once the deployment completes, your Guardia Planning
   App will be available at the provided Vercel URL.

You can modify the list of dates in `script.js` to reflect your real shift
schedule. Each date can host both a *Puerta* and a *Traumato* guardia, so
feel free to adjust the number of dates or types to suit your needs.