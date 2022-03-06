import { from } from 'rxjs';
import { raise } from '../src/actions/raise';
import {
  assign,
  createMachine,
  interpret,
  MachineContext,
  StateMachine
} from '../src/index';
import { createModel } from '../src/model';

function noop(_x: unknown) {
  return;
}

describe('StateSchema', () => {
  type LightEvent =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  interface LightContext {
    elapsed: number;
  }

  const lightMachine = createMachine<LightContext, LightEvent>({
    key: 'light',
    initial: 'green',
    meta: { interval: 1000 },
    context: { elapsed: 0 },
    states: {
      green: {
        id: 'green',
        meta: { name: 'greenLight' },
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red'
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        }
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red'
        },
        initial: 'walk',
        states: {
          walk: {
            on: {
              PED_COUNTDOWN: 'wait'
            }
          },
          wait: {
            on: {
              PED_COUNTDOWN: {
                target: 'stop',
                guard: (
                  ctx,
                  e: { type: 'PED_COUNTDOWN'; duration: number }
                ) => {
                  return e.duration === 0 && ctx.elapsed > 0;
                }
              }
            }
          },
          stop: {
            always: { target: '#green' }
          }
        }
      }
    }
  });

  noop(lightMachine);

  it('should work with a StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Parallel StateSchema', () => {
  type ParallelEvent =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'E' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  interface ParallelContext {
    elapsed: number;
  }

  const parallelMachine = createMachine<ParallelContext, ParallelEvent>({
    type: 'parallel',
    states: {
      foo: {},
      bar: {},
      baz: {
        initial: 'one',
        states: {
          one: { on: { E: 'two' } },
          two: {}
        }
      }
    }
  });

  noop(parallelMachine);

  it('should work with a parallel StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Nested parallel stateSchema', () => {
  interface ParallelEvent {
    type: 'UPDATE.CONTEXT';
  }

  interface ParallelContext {
    lastDate: Date;
  }

  const nestedParallelMachine = createMachine<ParallelContext, ParallelEvent>({
    initial: 'foo',
    states: {
      foo: {},
      bar: {},
      baz: {
        type: 'parallel',
        initial: 'blockUpdates',
        states: {
          blockUpdates: { type: 'final' },
          activeParallelNode: {
            on: {
              'UPDATE.CONTEXT': {
                actions: [
                  assign({
                    lastDate: new Date()
                  })
                ]
              }
            }
          }
        }
      }
    }
  });

  noop(nestedParallelMachine);

  it('should work with a parallel StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Raise events', () => {
  it('should work with all the ways to raise events', () => {
    type GreetingEvent =
      | { type: 'DECIDE'; aloha?: boolean }
      | { type: 'MORNING' }
      | { type: 'LUNCH_TIME' }
      | { type: 'AFTERNOON' }
      | { type: 'EVENING' }
      | { type: 'NIGHT' }
      | { type: 'ALOHA' };

    interface GreetingContext {
      hour: number;
    }

    const greetingContext: GreetingContext = { hour: 10 };

    const raiseGreetingMachine = createMachine<GreetingContext, GreetingEvent>({
      key: 'greeting',
      context: greetingContext,
      initial: 'pending',
      states: {
        pending: {
          on: {
            DECIDE: [
              {
                actions: raise({
                  type: 'ALOHA'
                }),
                guard: (_ctx, ev) => !!ev.aloha
              },
              {
                actions: raise({
                  type: 'MORNING'
                }),
                guard: (ctx) => ctx.hour < 12
              },
              {
                actions: raise({
                  type: 'AFTERNOON'
                }),
                guard: (ctx) => ctx.hour < 18
              },
              {
                actions: raise({ type: 'EVENING' }),
                guard: (ctx) => ctx.hour < 22
              }
            ]
          }
        },
        morning: {},
        lunchTime: {},
        afternoon: {},
        evening: {},
        night: {}
      },
      on: {
        MORNING: '.morning',
        LUNCH_TIME: '.lunchTime',
        AFTERNOON: '.afternoon',
        EVENING: '.evening',
        NIGHT: '.night'
      }
    });

    noop(raiseGreetingMachine);
    expect(true).toBeTruthy();
  });
});

describe('types', () => {
  it('defined context in createMachine() should be an object', () => {
    createMachine({
      // @ts-expect-error
      context: 'string'
    });
  });

  it('defined context passed to createModel() should be an object', () => {
    // @ts-expect-error
    createModel('string');
  });
});

describe('context', () => {
  it('should infer context type from `config.context` when there is no `schema.context`', () => {
    createMachine(
      {
        context: {
          foo: 'test'
        }
      },
      {
        actions: {
          someAction: (ctx) => {
            ((_accept: string) => {})(ctx.foo);
            // @ts-expect-error
            ((_accept: number) => {})(ctx.foo);
          }
        }
      }
    );
  });

  it('should not use actions as possible inference sites', () => {
    createMachine(
      {
        schema: {
          context: {} as {
            count: number;
          }
        },
        entry: (_ctx: any) => {}
      },
      {
        actions: {
          someAction: (ctx) => {
            ((_accept: number) => {})(ctx.count);
            // @ts-expect-error
            ((_accept: string) => {})(ctx.count);
          }
        }
      }
    );
  });

  it('should work with generic context', () => {
    function createMachineWithExtras<TContext extends MachineContext>(
      context: TContext
    ): StateMachine<TContext, any, any> {
      return createMachine({ context });
    }

    createMachineWithExtras({ counter: 42 });
  });

  it('should not widen literal types defined in `schema.context` based on `config.context`', () => {
    createMachine({
      schema: {
        context: {} as {
          literalTest: 'foo' | 'bar';
        }
      },
      context: {
        // @ts-expect-error
        literalTest: 'anything'
      }
    });
  });
});

describe('interpreter', () => {
  it('should be convertable to Rx observable', () => {
    const state$ = from(
      interpret(
        createMachine({
          schema: {
            context: {} as { count: number }
          }
        })
      )
    );

    state$.subscribe((state) => {
      ((_val: number) => {})(state.context.count);
      // @ts-expect-error
      ((_val: string) => {})(state.context.count);
    });
  });
});
