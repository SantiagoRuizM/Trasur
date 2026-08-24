ARG PYTHON_VERSION=3.14
ARG APP_NAME=proyecto3
ARG APP_PATH=/opt/backend
ARG VENV_PATH=/opt/venv

FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim

# Re-declare ARGs after FROM so they are available in this build stage
ARG APP_PATH
ARG VENV_PATH

# Non-root user for security
RUN groupadd --system --gid 999 nonroot \
 && useradd --system --gid 999 --uid 999 --create-home nonroot

# WeasyPrint native rendering libraries (Pango/HarfBuzz) + a base font set
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libharfbuzz-subset0 \
    fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR ${APP_PATH}

# Python environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1

# uv settings
# UV_PROJECT_ENVIRONMENT places the venv outside APP_PATH so it survives
# the dev volume mount (./backend:/opt/backend) without being shadowed
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_PROJECT_ENVIRONMENT=${VENV_PATH}

ENV PATH="${VENV_PATH}/bin:$PATH"

# Install dependencies first (cached layer — only re-runs when lock/pyproject change)
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

# Copy source and install the project itself
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

# Fix ownership so the non-root user can write migrations and static files
RUN chown -R nonroot:nonroot ${APP_PATH} ${VENV_PATH}

# Reset the entrypoint — don't invoke uv
ENTRYPOINT []

USER nonroot
