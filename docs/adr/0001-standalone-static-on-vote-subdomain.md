# Standalone static page on vote.coalitiontracker.nz

The Convert page is a different job from the commitment tracker. It lives in this repo as plain HTML/CSS/JS and ships on GitHub Pages with CNAME `vote.coalitiontracker.nz`, piggybacking the existing domain so there is no extra hosting cost. It is not compiled into coalition-tracker-nz.

Considered putting it inside the tracker’s React app. Rejected: an election-persuasion page should not share a deploy or codebase with an evidence tool, even though both are Dieuwe’s.
