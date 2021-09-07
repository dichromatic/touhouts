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
    startThrust = keyObservable('keydown','ArrowUp', ()=>new Thrust(1)),
    stopThrust = keyObservable('keyup','ArrowUp', ()=>new Thrust(0)),
    startReverse = keyObservable('keydown','ArrowDown', ()=>new Thrust(-1)),
    stopReverse = keyObservable('keyup','ArrowDown', ()=>new Thrust(0))

    type State = Readonly<{
        pos:Vec, 
        vel:Vec,
        acc:Vec,
        angle:number,
        rotation:number,
        torque:number
      }>

      

}



































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