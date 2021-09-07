import { fromEvent,interval, merge } from 'rxjs'; 
import { map,filter, flatMap, scan, takeUntil } from 'rxjs/operators';

type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Space'
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
    shoot = keyObservable('keydown','Space', ()=>new Shoot())

// --------------------------------------------------------------------------------------

    // define entity interface
    interface IEntity {
        ViewType: ViewType,
        id: string,
        radius: number,
        pos: Vec,
        vel: Vec,
        add: Vec,
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
            pos: new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.2),
            vel: Vec.Zero,
            add: Vec.Zero,
            createTime: 0
        }
    }
    
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
                bullets:s.bullets.map(moveEntity),
                time:elapsed
            })
        },

        // reducing states
        reduceState = (s:State, e:Translate|Thrust|Tick|Shoot)=>
            e instanceof Translate ? {...s, 
                ship: {...s.ship, 
                    add: Vec.unitVecInDirection(90).scale(e.magnitude)
                }
            } :
            e instanceof Thrust ? {...s,
                ship: {...s.ship,
                    add: Vec.unitVecInDirection(0).scale(e.magnitude)
                }
            } :
            e instanceof Shoot ? {...s,
                bullets: s.bullets.concat([
                    ((unitVec:Vec) => 
                        createBullet
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
                stopRightTranslate,startThrust,stopThrust,
                startReverse, stopReverse, shoot)
                .pipe(scan(reduceState, initialState)).subscribe(updateView)
        
        // view updater function
        function updateView(s: State) {
            const  
                ship = document.getElementById("ship")!,
                show = (id:string,condition:boolean)=>((e:HTMLElement) => 
                condition ? e.classList.remove('hidden'): e.classList.add('hidden'))(document.getElementById(id)!);
            ship.setAttribute('transform', `translate(${s.ship.pos.x},${s.ship.pos.y})`);
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
    showKey('Space');
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