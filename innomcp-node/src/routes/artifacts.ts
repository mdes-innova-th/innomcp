import { Router, Request, Response, NextFunction } from 'express';
import { artifactService } from '../services/artifactService';

const router = Router();

/**
 * GET /api/tasks/:taskId/artifacts
 * Returns a list of artifacts for a given task.
 */
router.get('/tasks/:taskId/artifacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const artifacts = await artifactService.listArtifacts(taskId);
    res.json(artifacts);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/:taskId/artifacts/:name
 * Downloads a specific artifact as an attachment.
 */
router.get('/tasks/:taskId/artifacts/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId, name } = req.params;
    const artifact = await artifactService.getArtifact(taskId, name);

    if (!artifact) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }

    const { buffer, mimeType, name: artifactName } = artifact;

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${artifactName}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export { router };
