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

function asteroids() {
  class Tick { constructor(public readonly elapsed:number) {} }
  class Translate { constructor(public readonly direction:number) {} }
  class Thrust { constructor(public readonly on:boolean) {} }
  class Reverse { constructor(public readonly on:boolean) {} }
  
  const keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
    fromEvent<KeyboardEvent>(document,e)
        .pipe(
          filter(({key})=>key === k),
          filter(({repeat})=>!repeat),
          map(result)),
    startLeftTranslate = keyObservable('keydown','ArrowLeft',()=>new Translate(-1)),
    startRightTranslate = keyObservable('keydown','ArrowRight',()=>new Translate(1)),
    stopLeftTranslate = keyObservable('keyup','ArrowLeft',()=>new Translate(0)),
    stopRightTranslate = keyObservable('keyup','ArrowRight',()=>new Translate(0)),
    startThrust = keyObservable('keydown','ArrowUp', ()=>new Thrust(true)),
    stopThrust = keyObservable('keyup','ArrowUp', ()=>new Thrust(false)),
    startReverse = keyObservable('keydown','ArrowDown', ()=>new Reverse(true)),
    stopReverse = keyObservable('keyup','ArrowDown', ()=>new Reverse(false))

  type State = Readonly<{
    pos:Vec, 
    vel:Vec,
    acc:Vec,
    angle:number,
    rotation:number,
    torque:number
  }>
  
  const initialState:State = {
      pos: new Vec(CanvasSize/2,CanvasSize/2), 
      vel: Vec.Zero, 
      acc: Vec.Zero, 
      angle:0,
      rotation:0,
      torque:0
  }
  const     
    reduceState = (s:State, e:Translate|Thrust|Tick|Reverse)=>
        e instanceof Translate ? {...s,
      torque:e.direction
    } :
    e instanceof Thrust ? {...s,
      acc:e.on?Vec.unitVecInDirection(s.angle).scale(1):Vec.Zero
    } : 
    e instanceof Reverse ? {...s, 
      acc:e.on?Vec.unitVecInDirection(s.angle).scale(-1):Vec.Zero
    } : 
    {...s,
      // rotation: s.rotation+s.torque,
      angle:s.angle+s.torque,
      pos: torusWrap(s.pos.add(s.vel)),
      vel:s.acc
    };
  interval(10)
    .pipe(
      map(elapsed=>new Tick(elapsed)),
      merge(
        startLeftTranslate,startRightTranslate,stopLeftTranslate,stopRightTranslate),
      merge(startThrust,stopThrust),
      merge(startReverse, stopReverse),
      scan(reduceState, initialState)
    ).subscribe(updateView);

  function updateView(s: State) {
    const 
      ship = document.getElementById("ship")!,
      show = (id:string,condition:boolean)=>((e:HTMLElement) => 
        condition ? e.classList.remove('hidden')
                  : e.classList.add('hidden'))(document.getElementById(id)!);
    show("leftThrust",  s.torque<0);
    show("rightThrust", s.torque>0);
    show("thruster",    s.acc.len()>0);
    show("reverseThrust", s.acc.len()<0);
    ship.setAttribute('transform', `translate(${s.pos.x},${s.pos.y}) rotate(${s.angle})`);
  }
} 
setTimeout(asteroids, 0)

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