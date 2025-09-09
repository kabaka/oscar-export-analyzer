## Adding Features

1. Create a component under `src/components` following the PascalCase naming convention.
2. Write colocated tests with the `.test.jsx` suffix using Testing Library.
3. Expose state or parameters via `DataContext` hooks as needed.
4. Add routes or buttons in `App.jsx` to surface new visualizations.
5. Place shared configuration values in `src/constants.js` so they can be reused across modules.
6. Update documentation and run `npm run lint` and `npm test -- --run` before committing.
