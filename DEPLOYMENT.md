# Hosting This App For Free

This app is a static website. You can host it on free static hosting without a server, build step, or database.

## Fastest Option: Netlify Drop

1. Open https://app.netlify.com/drop
2. Sign in or create a free Netlify account.
3. Drag this project folder into the drop zone.
4. Netlify will give you a public `netlify.app` URL.

If you use `credit-card-portfolio-site.zip`, unzip it first and drag the extracted folder. When you update the app later, drag the updated folder again.

## Good Long-Term Option: GitHub Pages

Use this if you want version history and easier future updates.

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `.nojekyll`.
3. In the repository, go to Settings > Pages.
4. Select the branch and root folder, then save.

GitHub will publish a public website URL for the repository.

If you see a GitHub Pages 404, check that Pages is enabled from Settings > Pages, the selected branch is `main`, the selected folder is `/(root)`, and the URL uses the exact repository name.

## Important Data Note

The card portfolio data is saved in the browser with `localStorage`. Hosting makes the app available everywhere, but each device keeps its own saved data. Use Export on one device and Import on another device to move your portfolio.

If you want one shared portfolio that syncs across devices, the next version should add a free backend such as Supabase or Firebase.
