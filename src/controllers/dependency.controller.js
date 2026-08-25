import { sendSuccess } from '../utils/api-response.js';
import { getDeletionDependencies } from '../utils/deletion-dependencies.js';
import { hasPermission } from '../utils/permissions.js';

export const getDependencies = async (request, response) => {
  const result = await getDeletionDependencies(request.params.type, request.params.id);
  const dependencies = result.dependencies.map((dependency) => {
    if (hasPermission(request.user, dependency.module.toLowerCase(), 'view')) {
      return dependency;
    }

    return {
      ...dependency,
      records: [],
      guidance: `${dependency.guidance} Ask the Admin for help if needed.`,
    };
  });

  return sendSuccess(response, {
    message: result.canDelete
      ? 'This record can be deleted'
      : 'This record is being used and cannot be deleted yet',
    data: { ...result, dependencies },
  });
};
