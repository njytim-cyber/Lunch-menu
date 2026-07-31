// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDispatcher } from '../js/ui/actions.js';

describe('createDispatcher', () => {
  let root, dispatcher;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <button data-action="generate">Generate</button>
        <button data-action="remove" data-meal="lunch" data-day="monday" data-dish="bee-hoon">x</button>
        <button data-action="nothing-registered">?</button>
        <span id="inner"><button data-action="generate" id="nested">G</button></span>
      </div>`;
    root = document.getElementById('root');
    dispatcher = createDispatcher(root);
    dispatcher.attach();
  });

  it('routes a click to the registered handler', () => {
    const spy = vi.fn();
    dispatcher.on('generate', spy);
    root.querySelector('[data-action="generate"]').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('passes the element so handlers can read data attributes', () => {
    const spy = vi.fn();
    dispatcher.on('remove', spy);
    root.querySelector('[data-action="remove"]').click();
    const el = spy.mock.calls[0][0];
    expect(el.dataset.meal).toBe('lunch');
    expect(el.dataset.dish).toBe('bee-hoon');
  });

  it('finds the action on an ancestor when the click lands on a child', () => {
    const spy = vi.fn();
    dispatcher.on('generate', spy);
    document.getElementById('nested').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('ignores actions with no registered handler', () => {
    expect(() => root.querySelector('[data-action="nothing-registered"]').click()).not.toThrow();
  });

  it('stops routing after detach', () => {
    const spy = vi.fn();
    dispatcher.on('generate', spy);
    dispatcher.detach();
    root.querySelector('[data-action="generate"]').click();
    expect(spy).not.toHaveBeenCalled();
  });
});
