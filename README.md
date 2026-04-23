This is a monorepo.

/frontend
  /app
    /(public)
      page.tsx              # landing page
      layout.tsx

    /(auth)
      login/page.tsx
      register/page.tsx

    /(dashboard)
      dashboard/
        layout.tsx          # sidebar + navbar layout
        page.tsx            # dashboard home

        users/
          page.tsx
          [id]/page.tsx

        reports/
          page.tsx

        settings/
          page.tsx

  /components
    /ui                     # DaisyUI wrappers (buttons, cards, etc.)
    /layout                 # navbar, sidebar, footer
    /shared                 # reusable components (tables, modals)

  /features
    /users
      components/
      hooks/
      services.ts
      types.ts

    /reports
      components/
      services.ts

  /lib
    api.ts                  # axios/fetch config
    auth.ts                 # token handling

  /hooks
    useAuth.ts
    useFetch.ts

  /styles
    globals.css

  /types
    index.ts

  /utils
    helpers.ts

  middleware.ts             # route protection (auth)

  tailwind.config.js
  postcss.config.js
  next.config.js
  package.json
