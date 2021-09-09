import { fromEvent,interval } from 'rxjs'; 
import { map,filter,flatMap,merge,scan, takeUntil } from 'rxjs/operators';

const 
    CanvasSize = 600,
    torusWrap = ({x,y}:Vec) => { 
        const wrap = (v:number) => 
        v < 0 ? v + CanvasSize : v > CanvasSize ? v - CanvasSize : v;
    return new Vec(wrap(x),wrap(y))
  };
  
type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'
type Event = 'keydown' | 'keyup'

function spaceinvaders() {
    // game has 4 game state changes
    class Tick { constructor(public readonly elapsed:number) {} }
    class Translate { constructor(public readonly magnitude:number) {} }
    class Thrust { constructor(public readonly magnitude:number) {} }
    class Shoot { constructor() {} }
  
    // define keypresses
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
    stopReverse = keyObservable('keyup','ArrowDown', ()=>new Thrust(0))

// --------------------------------------------------------------------------------------

    // define entity interface
    interface IEntity {
        id: string,
        pos: Vec,
        vel: Vec,
        add: Vec
    }

    type Entity = Readonly<IEntity>

    // define game state as type for a template
    type State = Readonly<{
        ship: Entity
    }>

    function createShip():Entity {
        return { 
            id: 'ship',
            pos: new Vec(CanvasSize/2, CanvasSize*0.8),
            vel: Vec.Zero,
            add: Vec.Zero,
        }
    }

// --------------------------------------------------------------------------------------

    // create initial state
    const initialState:State = {
        ship: createShip()
    }

    // reducing states
    const
        reduceState = (s:State, e:Translate|Thrust|Tick)=>
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
            {...s,
                ship: {...s.ship, 
                    pos: torusWrap(s.ship.pos.add(s.ship.vel)),
                    vel: s.ship.add
                }
            };

    interval(10)
        .pipe(
            map(elapsed=>new Tick(elapsed)),
            merge(
              startLeftTranslate,startRightTranslate,stopLeftTranslate,stopRightTranslate),
            merge(startThrust,stopThrust,startReverse, stopReverse),
            scan(reduceState, initialState)
        ).subscribe(updateView)
            
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