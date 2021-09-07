import { fromEvent,interval, merge } from 'rxjs'; 
import { map, filter, scan} from 'rxjs/operators';

type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'f'
type Event = 'keydown' | 'keyup'

function spaceinvaders() {
    // game constants
    const
        Constants = {
            CanvasSize:600,
            BulletRadius:3,
            BulletVelocity: 3,
            AlienVelocity: 3,
            PlayerVelocity: 5
        } as const

    // the game has these entity types:
    type ViewType = 'ship' | 'rock' | 'bullet' | 'alien'

    // game has these game state changes
    class Tick { constructor(public readonly elapsed:number) {} }
    class Translate { constructor(public readonly magnitude:number) {} }
    class Thrust { constructor(public readonly magnitude:number) {} }
    class Shoot { constructor() {} }

    // define game clock
    const gameClock = interval(10).pipe(map(elapsed => new Tick(elapsed)))
  
    // define keypress observables
    const keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
        fromEvent<KeyboardEvent>(document,e)
            .pipe(
                filter(({key})=>key === k),
                filter(({repeat})=>!repeat),
                map(result)),
    startLeftTranslate = keyObservable('keydown','ArrowLeft',()=>new Translate(-5)),
    startRightTranslate = keyObservable('keydown','ArrowRight',()=>new Translate(5)),
    stopLeftTranslate = keyObservable('keyup','ArrowLeft',()=>new Translate(0)),
    stopRightTranslate = keyObservable('keyup','ArrowRight',()=>new Translate(0)),
    startThrust = keyObservable('keydown','ArrowUp', ()=>new Thrust(5)),
    stopThrust = keyObservable('keyup','ArrowUp', ()=>new Thrust(0)),
    startReverse = keyObservable('keydown','ArrowDown', ()=>new Thrust(-5)),
    stopReverse = keyObservable('keyup','ArrowDown', ()=>new Thrust(0)),
    shoot = keyObservable('keydown','f', ()=>new Shoot())

// --------------------------------------------------------------------------------------

    // define entity interface
    interface IEntity {
        ViewType: ViewType,
        id: string,
        radius: number,
        pos: Vec,
        vel: Vec,
        add: Vec,
        acc: Vec,
        createTime: number
    }

    type Entity = Readonly<IEntity>

    // define game state as type for a template
    type State = Readonly<{
        time: number,
        ship: Entity,
        bullets: ReadonlyArray<Entity>,
        objCount: number
    }>

    // curried func to make entities with varying arguments
    const createEntity = (viewType: ViewType) => (id: string) => (radius: number) => (pos: Vec) => (timeCreated: number) => <Entity>{
        ViewType: viewType,
        id: id,
        radius: radius,
        pos: pos,
        vel: Vec.Zero,
        add: Vec.Zero,
        acc: Vec.Zero,
        createTime: timeCreated
    },
    createAlien = createEntity('alien'),
    createBullet = createEntity('bullet')

    // since there is only one ship, no need to make it out of a createentity instance
    function createShip():Entity {
        return { 
            ViewType: 'ship',
            id: 'ship',
            radius: 20,
            pos: new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.8),
            vel: Vec.Zero,
            add: Vec.Zero,
            acc: Vec.Zero,
            createTime: 0
        }
    }

    // bullets will have different physics to the normal ship movement, so will implement the physics from asteroids:
    
    
// --------------------------------------------------------------------------------------

    // create initial state
    const 
    
        initialState:State = {
            time: 0,
            ship: createShip(),
            bullets: [],
            objCount: 1
        },
        
        // toruswrap taken from asteroids
        torusWrap = ({x,y}:Vec) => { 
            const wrap = (v:number) => 
            v < 0 ? v + Constants.CanvasSize : v > Constants.CanvasSize ? v - Constants.CanvasSize : v;
        return new Vec(wrap(x),wrap(y))
        },

        // movement of entities go through here for simplicity
        moveEntity = (o: Entity) => <Entity> {
            ...o,
            pos: torusWrap(o.pos.add(o.vel)),
            vel: o.add
        },

        // movement of bullet needs to have a constant velocity, so needs different physics
        moveBullet = (o:Entity) => <Entity>{
            ...o,
            pos:torusWrap(o.pos.add(o.vel)),
            vel:Vec.unitVecInDirection(0).scale(5)
        },

        // function to handle collisions that returns state NOT DONE
        handleCollisions = (s:State) => {
            // const
            //     entitiesCollided = ([a,b]:[Entity, Entity]) => a.pos.sub(b.pos).len() < a.radius + b.radius,
            //     ship
            return <State> {
                ...s
            }
        },

        // interval tick, for now only handles things without any collisions
        tick = (s:State, elapsed:number) => {
            return handleCollisions({...s,
                ship:moveEntity(s.ship),
                bullets:s.bullets.map(moveBullet),
                time:elapsed
            })
        },

        // reducing states
        reduceState = (s:State, e:Shoot|Translate|Thrust|Tick)=>
            e instanceof Translate ? {...s, 
                ship: {...s.ship, 
                    add: Vec.unitVecInDirection(90).scale(e.magnitude)  // puts a magnitude into add to add onto position vector later in moveEntity
                }
            } :
            e instanceof Thrust ? {...s,
                ship: {...s.ship,
                    add: Vec.unitVecInDirection(0).scale(e.magnitude)   // puts a magnitude into add to add onto position vector later in moveEntity
                }
            } :
            e instanceof Shoot ? {...s,
                bullets: s.bullets.concat([
                    ((unitVec:Vec) => 
                        createBullet                                    //create new bullet on space press
                        (String(s.objCount))                            //bullet id
                        (3)                                             //bullet rad
                        (s.ship.pos.add(unitVec.scale(s.ship.radius)))  //bullet pos
                        (s.time))                                       //bullet time created
                        (Vec.unitVecInDirection(0))]),                  //bullet direction vector
                objCount: s.objCount + 1 
            } :
            tick(s, e.elapsed)
        
        // merge all events and subscribe to updater
        const subscription = 
            merge(gameClock, startLeftTranslate,startRightTranslate,stopLeftTranslate,
                stopRightTranslate,startThrust,stopThrust,startReverse, stopReverse,
                shoot)  
                .pipe(scan(reduceState, initialState)).subscribe(updateView, x => {console.log(x.ship.vel)})
        
        // view updater function
        function updateView(s: State) {
            const  
                ship = document.getElementById("ship")!,
                svg = document.getElementById("svgCanvas")!,
                show = (id:string,condition:boolean)=>((e:HTMLElement) => 
                condition ? e.classList.remove('hidden'): e.classList.add('hidden'))(document.getElementById(id)!),
                updateEntityView = (b: Entity) => {
                    function createEntityView() {
                        const v = document.createElementNS(svg.namespaceURI, "ellipse")!;
                        attr(v, {id:b.id, rx: b.radius, ry:b.radius});
                        v.classList.add(b.ViewType)
                        svg.appendChild(v);
                        return v;
                    }
                    const v = document.getElementById(b.id) || createEntityView();
                    attr(v, {cx:b.pos.x, cy:b.pos.y})
                };
            attr(ship, {transform: `translate(${s.ship.pos.x},${s.ship.pos.y})`});
            s.bullets.forEach(updateEntityView)
        }
    }

setTimeout(spaceinvaders, 0)

// --------------------------------------------------------------------------------------

function showKeys() {
    function showKey(k:Key) {
        const arrowKey = document.getElementById(k)!,
            o = (e:Event) => fromEvent<KeyboardEvent>(document,e).pipe(filter(({key})=>key === k))
        o('keydown').subscribe(_=>arrowKey.classList.add("highlight"))
        o('keyup').subscribe(_=>arrowKey.classList.remove("highlight"))
    }
    showKey('ArrowLeft');
    showKey('ArrowRight');
    showKey('ArrowUp');
    showKey('ArrowDown');
    showKey('f');
  }
setTimeout(showKeys, 0)

































class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) {}
    add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
    sub = (b:Vec) => this.add(b.scale(-1))
    len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
    scale = (s:number) => new Vec(this.x*s,this.y*s)
    ortho = ()=> new Vec(this.y,-this.x)
    Translate = (deg:number) =>
                (rad =>(
                    (cos,sin,{x,y})=>new Vec(x*cos - y*sin, x*sin + y*cos)
                )(Math.cos(rad), Math.sin(rad), this)
                )(Math.PI * deg / 180)
    
    static unitVecInDirection = (deg: number) => new Vec(0,-1).Translate(deg)
    static Zero = new Vec();
    }

/**
 * apply f to every element of a and return the result in a flat array
 * @param a an array
 * @param f a function that produces an array
 */
function flatMap<T,U>(
    a:ReadonlyArray<T>,
    f:(a:T)=>ReadonlyArray<U>
  ): ReadonlyArray<U> {
    return Array.prototype.concat(...a.map(f));
  }
  
  const 
  /**
   * Composable not: invert boolean result of given function
   * @param f a function returning boolean
   * @param x the value that will be tested with f
   */
    not = <T>(f:(x:T)=>boolean)=> (x:T)=> !f(x),
  /**
   * is e an element of a using the eq function to test equality?
   * @param eq equality test function for two Ts
   * @param a an array that will be searched
   * @param e an element to search a for
   */
    elem = 
      <T>(eq: (_:T)=>(_:T)=>boolean)=> 
        (a:ReadonlyArray<T>)=> 
          (e:T)=> a.findIndex(eq(e)) >= 0,
  /**
   * array a except anything in b
   * @param eq equality test function for two Ts
   * @param a array to be filtered
   * @param b array of elements to be filtered out of a
   */ 
    except = 
      <T>(eq: (_:T)=>(_:T)=>boolean)=>
        (a:ReadonlyArray<T>)=> 
          (b:ReadonlyArray<T>)=> a.filter(not(elem(eq)(b))),
  /**
   * set a number of attributes on an Element at once
   * @param e the Element
   * @param o a property bag
   */         
    attr = (e:Element,o:Object) =>
      { for(const k in o) e.setAttribute(k,String(o[k])) }
  /**
   * Type guard for use in filters
   * @param input something that might be null or undefined
   */
  function isNotNullOrUndefined<T extends Object>(input: null | undefined | T): input is T {
    return input != null;
  }