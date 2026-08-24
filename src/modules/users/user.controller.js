import { sendSuccess } from '../../utils/api-response.js';
import * as userService from './user.service.js';

export const createUser = async (request, response) => {
  const user = await userService.createUser(request.body);
  return sendSuccess(response, {
    statusCode: 201,
    message: 'User created successfully',
    data: user,
  });
};

export const getUsers = async (request, response) => {
  const result = await userService.getUsers(request.query);
  return sendSuccess(response, {
    message: 'Users fetched successfully',
    data: result.users,
    pagination: result.pagination,
  });
};

export const getUser = async (request, response) => {
  const user = await userService.getUserById(request.params.id);
  return sendSuccess(response, { message: 'User fetched successfully', data: user });
};

export const updateUser = async (request, response) => {
  const user = await userService.updateUser(request.params.id, request.body, request.userId);
  return sendSuccess(response, { message: 'User updated successfully', data: user });
};

export const deleteUser = async (request, response) => {
  await userService.deleteUser(request.params.id, request.userId);
  return sendSuccess(response, { message: 'User deleted successfully' });
};
