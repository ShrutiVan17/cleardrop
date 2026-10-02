# Free Render deployment

`render.yaml` declares one Docker web service on the **free** compute plan, with no paid database or disk. Alternatively, create a Web Service from this public repository, select Docker and explicitly select Free before creating it. The existing Dockerfile runs the deterministic tests and production build before starting the app. No payment details are required for this setup.

Set the private environment values in Render, not in GitHub: `CLEARDROP_SITE_URL` must be the exact HTTPS service origin, and the three `SUPABASE_*` values must come from the existing project. The secret key is server-only. Do not add a shared Ring Playground token: authenticated owners connect their own short-lived preview sessions in `/doorway`. Public signup remains disabled until SMTP and abuse controls are verified.

In Supabase URL Configuration, set the intended site URL and add its exact `/auth/confirm` redirect. Keep localhost or the old hosted redirect only if those installations are still in use. Verify public routes, anonymous rejection of private APIs, confirmed-account login, and real camera frames after deployment. An infrastructure health check alone does not verify these flows.

## Free-tier constraints

According to [Render's free-service documentation](https://render.com/docs/free), free web services sleep after 15 minutes without inbound traffic and can take about a minute to wake. A workspace receives 750 free instance hours per month, shared across its free services. Bandwidth/build limits and restarts still apply; this is a prototype hosting option, not an uptime guarantee. Do not enable paid upgrades or add payment details to bypass quotas.

The filesystem and in-process Ring sessions are temporary. Restarting or replacing a sleeping instance can require signing in and reconnecting Ring. Run only one instance: distributing this prototype across replicas would require durable, isolated session storage. Phone-camera analysis is foreground and local, not remote or background surveillance. Retain a recorded demonstration of actual tested behavior alongside the public link.
