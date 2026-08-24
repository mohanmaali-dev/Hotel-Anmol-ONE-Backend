import { Setting } from '../models/setting.model.js';
import { sendSuccess } from '../utils/api-response.js';

const SETTINGS_KEY = 'restaurant-settings';

const getOrCreateSettings = () =>
  Setting.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY } },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

export const getSettings = async (_request, response) => {
  const settings = await getOrCreateSettings();
  return sendSuccess(response, { data: settings });
};

export const getPublicSettings = async (_request, response) => {
  const settings = await getOrCreateSettings();
  return sendSuccess(response, {
    data: {
      restaurant: settings.restaurant,
      billing: settings.billing,
      order: settings.order,
      stock: settings.stock,
    },
  });
};

export const updateSettings = async (request, response) => {
  const settings = await getOrCreateSettings();
  const sections = ['restaurant', 'billing', 'order', 'stock'];

  for (const section of sections) {
    if (request.body[section] && typeof request.body[section] === 'object') {
      Object.assign(settings[section], request.body[section]);
    }
  }

  await settings.save();
  return sendSuccess(response, {
    message: 'Settings saved successfully',
    data: settings,
  });
};
