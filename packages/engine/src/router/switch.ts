/** MOOVI_ROUTER=pipeline turns on the one way in (Stage 1 W1); off, today's router runs. No imports: the studio reads it too. */
export const pipelineOn = (env = process.env.MOOVI_ROUTER) => (env ?? '').trim().toLowerCase() === 'pipeline';
