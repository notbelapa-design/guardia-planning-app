# Guardia Planning App

This repository contains an interactive web application that helps four
residents plan their guardia (on‑call) shifts. The latest version
introduces an **administrative setup phase** to build the list of available
guardias, a **calendar overview**, and a fairer conflict‑resolution
mechanism that takes unpopular days (Mondays and Fridays) into account.
Each resident must select a certain number of shifts (four in the
default configuration). Shifts may be of two types: **Puerta** (door)
or **Traumato** (trauma). Conflicts are highlighted and can be resolved
automatically.

## Features

- **Admin setup:** Before scheduling begins, an administrator can add
  guardias by choosing a date and type. This allows the shift list to be
  tailored to the clinic’s real schedule rather than relying on a hard‑coded
  list.
- **Resident selection:** Each resident chooses their name from a drop‑down
  menu and can then select up to the maximum number of guardias assigned to
  them.
- **Shift table:** Displays all guardias with columns for date, type,
  assigned residents and a checkbox for the current resident to claim the
  slot. Conflicting rows are highlighted automatically.
- **Monday/Friday tally:** The interface shows how many of the current
  resident’s selections fall on Mondays or Fridays—typically the least
  desirable days.
- **Fair conflict resolution:** When conflicts occur (multiple residents
  selecting the same shift), clicking **Resolve conflicts** assigns each
  contested guardia to the resident with the fewest Monday/Friday shifts.
  If there is still a tie, the resident with fewer total assignments wins;
  if tied again, a random resident is chosen.
- **Calendar view:** A responsive month‑by‑month calendar highlights
  Mondays and Fridays and displays every guardia along with its assigned
  resident(s). This provides a clear overview of the schedule.

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

The default configuration allows four residents to pick up to four guardias
each, but these values can be changed in `script.js`. The admin setup
interface lets you define exactly which dates and guardia types are
available, so there is no need to edit code to update the schedule.