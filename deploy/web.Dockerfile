# The static viewer, served by nginx on Cloud Run.
#
# Read-only by construction: the image contains the built site and nothing
# else. There is no server-side code here, no credential, and nothing that can
# write. A session file a visitor opens is read by the browser and never
# reaches this container.
FROM nginx:1.27-alpine

# Cloud Run sends traffic to $PORT and the contract is that the container
# listens there. nginx cannot read the environment in its config, so the port
# is substituted into the template at start.
ENV PORT=8080
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/dist /usr/share/nginx/html

EXPOSE 8080
