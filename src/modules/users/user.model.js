import mongoose from 'mongoose';

import { hashPassword } from '../../utils/password.js';
import { PERMISSION_ACTIONS, PERMISSION_MODULES, USER_ROLES } from './user.constants.js';

const permissionSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      enum: PERMISSION_MODULES,
      required: true,
    },
    actions: {
      type: [{ type: String, enum: PERMISSION_ACTIONS }],
      default: [],
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      default: undefined,
      set: (value) => value?.trim().toLowerCase() || undefined,
      validate: {
        validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: 'Email must be valid',
      },
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{7,15}$/, 'Phone must contain 7 to 15 digits'],
    },
    password: {
      type: String,
      required: true,
      select: false,
      minlength: 8,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'Staff',
      index: true,
    },
    permissions: {
      type: [permissionSchema],
      default: [],
      validate: {
        validator(permissions) {
          const modules = permissions.map((entry) => entry.module);
          return new Set(modules).size === modules.length;
        },
        message: 'Duplicate permission modules are not allowed',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_document, user) => {
        delete user.password;
        user.status = user.isActive ? 'Active' : 'Inactive';
        return user;
      },
    },
  },
);

userSchema.pre('save', async function protectPassword() {
  if (!this.isModified('password')) return;
  this.password = await hashPassword(this.password);
});

export const User = mongoose.model('User', userSchema);
