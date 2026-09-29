import { describe, expect, it } from 'vitest';
import { classifyPort, type ClassifyInput } from '../classifier';

// Fixtures mirror real listeners observed on a macOS dev machine.
const base: ClassifyInput = {
  comm: '',
  execPath: null,
  cwd: null,
  ppid: null,
  isProtected: false,
  hasProject: false,
  homeDir: '/Users/ravi'
};

describe('classifyPort', () => {
  it('treats a node dev server started from a terminal as dev', () => {
    expect(
      classifyPort({
        ...base,
        comm: 'node',
        execPath: '/opt/homebrew/Cellar/node/22.9.0/bin/node',
        cwd: '/Users/ravi/code/web',
        ppid: 4211,
        hasProject: true
      })
    ).toBe('dev');
  });

  it('keeps a backgrounded dev server (re-parented to launchd) as dev when its cwd is under $HOME', () => {
    expect(
      classifyPort({ ...base, comm: 'python3', execPath: '/usr/bin/python3', cwd: '/Users/ravi/code/api', ppid: 1 })
    ).toBe('dev');
  });

  it('treats framework python3 (whose binary sits in a nested Python.app) as dev, not app', () => {
    expect(
      classifyPort({
        ...base,
        comm: 'Python',
        execPath:
          '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/Resources/Python.app/Contents/MacOS/Python',
        cwd: '/Users/ravi/code/api',
        ppid: 4211
      })
    ).toBe('dev');
  });

  it('classifies ControlCenter AirPlay receiver (ports 5000/7000) as system', () => {
    expect(
      classifyPort({
        ...base,
        comm: 'ControlCenter',
        execPath: '/System/Library/CoreServices/ControlCenter.app/Contents/MacOS/ControlCenter',
        cwd: '/',
        ppid: 1
      })
    ).toBe('system');
  });

  it('classifies rapportd as system', () => {
    expect(classifyPort({ ...base, comm: 'rapportd', execPath: '/usr/libexec/rapportd', cwd: '/', ppid: 1 })).toBe(
      'system'
    );
  });

  it('classifies IDE helper processes inside an app bundle as app', () => {
    expect(
      classifyPort({
        ...base,
        comm: 'language_server_macos_arm',
        execPath: '/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/bin/language_server_macos_arm',
        cwd: '/',
        ppid: 25003
      })
    ).toBe('app');
  });

  it('classifies homebrew redis as database', () => {
    expect(
      classifyPort({
        ...base,
        comm: 'redis-server',
        execPath: '/opt/homebrew/Cellar/redis/7.2.5/bin/redis-server',
        cwd: '/opt/homebrew/var/db/redis',
        ppid: 1
      })
    ).toBe('database');
  });

  it('classifies the Docker backend port forwarder as docker', () => {
    expect(
      classifyPort({
        ...base,
        comm: 'com.docker.backend',
        execPath: '/Applications/Docker.app/Contents/MacOS/com.docker.backend',
        cwd: '/',
        ppid: 72160
      })
    ).toBe('docker');
  });

  it('classifies a launchd-managed daemon outside $HOME as service', () => {
    expect(
      classifyPort({ ...base, comm: 'nginx', execPath: '/opt/homebrew/Cellar/nginx/1.27.0/bin/nginx', cwd: '/opt/homebrew', ppid: 1 })
    ).toBe('service');
  });

  it('classifies protected processes as system regardless of path', () => {
    expect(classifyPort({ ...base, comm: 'launchd', isProtected: true })).toBe('system');
  });

  it('falls back to dev when there is no process info', () => {
    expect(classifyPort({ ...base, comm: 'mystery' })).toBe('dev');
  });
});
