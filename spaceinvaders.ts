import { fromEvent,interval, merge } from 'rxjs'; 
import { map, filter, scan} from 'rxjs/operators';

type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'f' | 'q' | 'w'
type Event = 'keydown' | 'keyup'

function spaceinvaders() {

    // game constants
    const
        Constants = {
            CanvasSize:600,
            BulletRadius: 5,
            BulletVelocity: 3,
            AlienBulletVelocity: 1.5,
            AlienBulletDirection: 180,
            AlienVelocity: 1,
            PlayerVelocity: 3,
            PlayerRadius: 5,
            AlienRadius: 10,
            StartAlienAmount: 30
        } as const

    // the game has these entity types:
    type ViewType = 'ship' | 'rock' | 'bullet' | 'alien' | 'alienbullet' | 'shields'

    // game has these game state changes
    class Tick { constructor(public readonly elapsed:number) {} }
    class Translate { constructor(public readonly magnitude:number) {} }
    class Thrust { constructor(public readonly magnitude:number) {} }
    class Shoot { constructor() {} }
    class Level { constructor(public readonly level:number) {} }

    // define game clock
    const gameClock = interval(10).pipe(map(elapsed => new Tick(elapsed)))
  
    // define keypress observables
    const keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
        fromEvent<KeyboardEvent>(document,e)
            .pipe(
                filter(({key})=>key === k),
                filter(({repeat})=>!repeat),
                map(result)),
    startLeftTranslate = keyObservable('keydown','ArrowLeft',()=>new Translate(-Constants.PlayerVelocity)),
    startRightTranslate = keyObservable('keydown','ArrowRight',()=>new Translate(Constants.PlayerVelocity)),
    stopLeftTranslate = keyObservable('keyup','ArrowLeft',()=>new Translate(0)),
    stopRightTranslate = keyObservable('keyup','ArrowRight',()=>new Translate(0)),
    startThrust = keyObservable('keydown','ArrowUp', ()=>new Thrust(Constants.PlayerVelocity)),
    stopThrust = keyObservable('keyup','ArrowUp', ()=>new Thrust(0)),
    startReverse = keyObservable('keydown','ArrowDown', ()=>new Thrust(-Constants.PlayerVelocity)),
    stopReverse = keyObservable('keyup','ArrowDown', ()=>new Thrust(0)),
    shoot = keyObservable('keydown','f', ()=>new Shoot()),
    level1 = keyObservable('keydown','q', ()=>new Level(1)),
    level2 = keyObservable('keydown','w', ()=>new Level(2))

// --------------------------------------------------------------------------------------
// defining templates for entities and state

    // define entity interface
    interface IEntity {
        ViewType: ViewType,     // type of entity
        id: string,             // id of entity (based on total state object count)
        radius: number,         // radius of entity (everything is a circle)
        pos: Vec,               // position vector of entity
        vel: Vec,               // velocity vector of entity
        add: Vec,               // potential velocity addition vector of entity
        acc: Vec,               // potential acceleration addition vector of entity
        createTime: number      // time entity is created in relation to Tick interval
    }

    type Entity = Readonly<IEntity>

    // define game state as type for a template
    type State = Readonly<{
        time: number,                       // time the state is in in relation to Tick interval
        ship: Entity,                       // the sole ship / player in the game
        shields: ReadonlyArray<Entity>,     // players shields
        bullets: ReadonlyArray<Entity>,     // bullet objects array
        alienBullets: ReadonlyArray<Entity> // alienbullet objects array
        aliens: ReadonlyArray<Entity>,      // aliens array
        garbage: ReadonlyArray<Entity>,     // garbage objects array, things that need to be removed from screen in updateview
        objCount: number,                   // object count 
        gameOver: boolean,
        gameWon: boolean
    }>

// --------------------------------------------------------------------------------------
// functions to create state and entities 

    // curried func to make entities with varying arguments
    const createEntity = (viewType: ViewType) => (id: string) => (radius: number) => (pos: Vec) => (vel: Vec) => (timeCreated: number) => <Entity>{
        ViewType: viewType,
        id: id,
        radius: radius,
        pos: pos,
        vel: vel,
        add: Vec.Zero,
        acc: Vec.Zero,
        createTime: timeCreated
    },
    createAlien = createEntity('alien'),
    createBullet = createEntity('bullet'),
    createAlienBullet = createEntity('alienbullet'),
    createShield = createEntity('shields')

    // since there is only one ship, no need to make it out of a createentity instance
    function createShip():Entity {
        return { 
            ViewType: 'ship',
            id: 'ship',
            radius: Constants.PlayerRadius,
            pos: new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.8),
            vel: Vec.Zero,
            add: Vec.Zero,
            acc: Vec.Zero,
            createTime: 0
        }
    }

    const
        // create initial state and entities
        initialState:State = {
            time: 0,
            ship: createShip(),
            shields: [].concat(
                [...Array(3)].map((_,i) => createShield(String(i))(((i+1)*3))(new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.8).add(Vec.unitVecInDirection(60).scale(35)))(Vec.Zero)(0)),
                [...Array(3)].map((_,i) => createShield(String(i+3))((i+1)*3)(new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.8).add(Vec.unitVecInDirection(300).scale(35)))(Vec.Zero)(0)),
                [...Array(3)].map((_,i) => createShield(String(i+6))((i+1)*3)(new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.8).add(Vec.unitVecInDirection(0).scale(-35)))(Vec.Zero)(0))
                ),
            bullets: [],
            alienBullets: [],
            aliens: [],
            garbage: [],
            objCount: 50,
            gameOver: false,
            gameWon: false
        },
    
// --------------------------------------------------------------------------------------
// functions to manipulate state and entities

        // interval tick which calls state and entity manipulators
        tick = (s:State, elapsed:number) => {

            // deletion of entities that are out of y bounds, split into active and binned. active uses not which comes from asteroids
            const boundarybinY = (o: Entity) => o.pos.y >= Constants.CanvasSize || o.pos.y <= 0,
                binnedBullets: Entity[] = s.bullets.filter(boundarybinY),
                activeBullets = s.bullets.filter(not(boundarybinY)),
                binnedAlienBullets: Entity[] = s.alienBullets.filter(boundarybinY),
                activeAlienBullets = s.alienBullets.filter(not(boundarybinY))

            // toruswrap from asteroids
            const torusWrap = ({x,y}:Vec) => { 
                const wrap = (v:number) => 
                v < 0 ? v + Constants.CanvasSize : v > Constants.CanvasSize ? v - Constants.CanvasSize : v;
            return new Vec(wrap(x),wrap(y))
            }

            // toruswrap taken from asteroids, but only done on X dimension
            const torusWrapX = ({x,y}:Vec) => { 
                const wrap = (v:number) => 
                v < 0 ? v + Constants.CanvasSize : v > Constants.CanvasSize ? v - Constants.CanvasSize : v;
            return new Vec(wrap(x),y)
            }

            // function to give aliens custom movement
            const alienMovement = (o: Entity) => <Entity> {...o,
                add: Vec.unitVecInDirection(elapsed).scale(1).add(Vec.unitVecInDirection(0).scale(-1)),
                pos: torusWrap(o.pos.add(o.vel)),
                vel: o.add
            }

            // movement of entities go through here 
            const moveEntity = (o: Entity) => <Entity> {
                ...o,
                pos: torusWrap(o.pos.add(o.vel)),
                vel: o.add
            }

            // movement of bullet needs to have a constant velocity, so needs different physics. 
            const moveBullet = (o:Entity) => <Entity>{
                ...o,
                pos:torusWrapX(o.pos.add(o.vel)),
                vel:Vec.unitVecInDirection(0).scale(Constants.BulletVelocity)
            }

            // movement of alien bullet has different direction
            const moveAlienBullet = (o: Entity) => <Entity>{
                ...o,
                pos:o.pos.add(o.vel),
            }

            // function to handle collisions that returns state
            const handleCollisions = (s:State) => {
                const entitiesCollided = ([a,b]: [Entity,Entity]) => a.pos.sub(b.pos).len() < a.radius + b.radius,      // check if the positions of both entities are in the region of their radii

                shipAlienCollision = s.aliens.filter(r => entitiesCollided([s.ship, r])).length > 0,                    // check if the ship has collided with an entity
                shipBulletCollision = s.alienBullets.filter(r => entitiesCollided([s.ship, r])).length > 0,             

                allBulletsAndAliens = flatMap(s.bullets, b => s.aliens.map<[Entity, Entity]>(r => [b, r])),             // flatten bullets and aliens 
                collidedBulletsAndAliens = allBulletsAndAliens.filter(entitiesCollided),                                // filter for collided bullets and aliens

                allAlienBulletsAndShields = flatMap(s.alienBullets, b=> s.shields.map<[Entity, Entity]>(r => [b, r])),  // flatten alien bulletrs and shields
                collidedAlienBulletsAndShields = allAlienBulletsAndShields.filter(entitiesCollided),                    // filter for collided alien bullets and shields

                allAliensAndShields = flatMap(s.aliens, b=> s.shields.map<[Entity, Entity]>(r => [b, r])),              // flatten aliens and shields
                collidedAliensAndShields = allAliensAndShields.filter(entitiesCollided),                                // filter for collided alien bullets and shields

                collidedShields = [].concat(collidedAlienBulletsAndShields.map(([_, shields]) => shields),collidedAliensAndShields.map(([shields, _]) => shields)), // array of shields that have collided  
                collidedAlienBullets = collidedAlienBulletsAndShields.map(([alienBullets, _]) => alienBullets),                                                     // array of alien bullets that have collided
                collidedBullets = collidedBulletsAndAliens.map(([bullet, _]) => bullet),                                                                            // array of bullets that have collided
                collidedAliens = [].concat(collidedBulletsAndAliens.map(([_, aliens]) => aliens), collidedAliensAndShields.map(([_, aliens]) => aliens)),           // array of aliens that have collided

                win = s.alienBullets.length > 0 && s.aliens.length === 0,                                               // condition for winning game

                cut = except((a: Entity) => (b: Entity) => a.id === b.id)                                               // function for cutting out the entities that have collided

                return <State> {...s,
                    bullets: cut(s.bullets)(collidedBullets),
                    aliens: cut(s.aliens)(collidedAliens),
                    alienBullets: cut(s.alienBullets)(collidedAlienBullets),
                    shields: cut(s.shields)(collidedShields),
                    garbage: s.garbage.concat(collidedBullets, collidedAliens, collidedShields, collidedAlienBullets),
                    gameOver: shipAlienCollision || shipBulletCollision,
                    gameWon: win
                };
            }

            // one of the most scuffed map callback functions i have ever written - converts every alien into an alienbullet just so i can spawn an alien bullet with position relative to the alien every half a second
            const createAlienBullets = (s:State) => {
                return <State> {...s,
                    alienBullets: s.time % 50 === 0 ? s.alienBullets.concat(s.aliens.map(x => 
                        createAlienBullet
                        (String(elapsed+Number(x.id)+s.objCount))
                        (Constants.BulletRadius)
                        (x.pos.add(Vec.unitVecInDirection(0).scale(-20)))
                        (x.vel)
                        (elapsed)
                        )): s.alienBullets,
                    objCount: s.time % 50 === 0 ? elapsed+s.objCount+100 : s.objCount
                }
            }

            // bring everything together
            return createAlienBullets(handleCollisions({...s,
                ship:moveEntity(s.ship),
                shields: s.shields.map(moveEntity),
                bullets: activeBullets.map(moveBullet),
                aliens: s.aliens.map(alienMovement),
                alienBullets: activeAlienBullets.map(moveAlienBullet),
                time: elapsed,
                garbage: s.garbage.concat(binnedBullets, binnedAlienBullets)
            }))
        },

// --------------------------------------------------------------------------------------    
// final state reducers

        // reducing states
        reduceState = (s:State, e:Shoot|Translate|Thrust|Tick)=>
            e instanceof Translate ? {...s, 
                ship: {...s.ship, 
                    add: Vec.unitVecInDirection(90).scale(e.magnitude)  // puts a magnitude into add to add onto velocity vector later in moveEntity
                },
                shields: s.shields.map(x => <Entity> {...x, add: Vec.unitVecInDirection(90).scale(e.magnitude)}) // move shields with input as well, syncing with ship
            } :
            e instanceof Thrust ? {...s,
                ship: {...s.ship,
                    add: Vec.unitVecInDirection(0).scale(e.magnitude)   // puts a magnitude into add to add onto velocity vector later in moveEntity
                },
                shields: s.shields.map(x => <Entity> {...x, add: Vec.unitVecInDirection(0).scale(e.magnitude)}) // move shields with input as well, syncing with ship
            } :
            e instanceof Shoot ?{...s,
                bullets: s.bullets.concat([
                    ((unitVec:Vec) => 
                        createBullet                                    //create new bullet on space press
                        (String(s.objCount))                            //bullet id
                        (Constants.BulletRadius)                        //bullet rad
                        (s.ship.pos.add(unitVec.scale(25)))             //bullet pos
                        (Vec.Zero)
                        (s.time))                                       //bullet time created
                        (Vec.unitVecInDirection(0))]),                  //bullet direction vector
                objCount: s.objCount + 1 
            } :
            e instanceof Level ? e.level === 1 ? {...s,
                aliens: [...Array(8)].map((_,i) => createAlien(String(i+12))(Constants.AlienRadius)(new Vec((i)*100, 100))(Vec.Zero)(0))
            }: {...s,
                aliens: s.aliens.concat([...Array(8)].map((_,i) => createAlien(String(i+12))(Constants.AlienRadius)(new Vec((i)*100, 0))(Vec.Zero)(0)), [...Array(8)].map((_,i) => createAlien(String(i+28))(Constants.AlienRadius)(new Vec((i)*100, 200))(Vec.Zero)(0)))
            }:
            tick(s, e.elapsed) // passes Tick time to tick function if not instance of anything else
        
        // main game stream. merge all events and subscribe to updater
        const subscription = 
            merge(gameClock, startLeftTranslate,startRightTranslate,stopLeftTranslate, 
                stopRightTranslate,startThrust,stopThrust,startReverse, stopReverse,
                shoot, level1, level2)  
                .pipe(scan(reduceState, initialState)).subscribe(updateView)

// --------------------------------------------------------------------------------------
// update view
        
        // view updater function - only part of the code that isnt pure
        function updateView(s: State) {
            const  
                ship = document.getElementById("ship")!,
                svg = document.getElementById("svgCanvas")!,
                updateEntityView = (b: Entity) => { // taken from asteroids as a way to generate entity objects for HTML
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
            s.shields.forEach(updateEntityView)
            s.aliens.forEach(updateEntityView)
            s.bullets.forEach(updateEntityView)
            s.alienBullets.forEach(updateEntityView)
            
            s.garbage // remove entities that are in the garbage. uses helper functions from asteroids
                .map(o => document.getElementById(o.id))
                .filter(isNotNullOrUndefined)
                .forEach(v => {
                    try{
                        svg.removeChild(v);
                    } catch (e) {
                        // rarely it can happen that a bullet can be in garbage and for both out of bounding and colliding in the same tick, which will cause this exception. this is taken from asteroids
                        console.log('Already removed: ' + v.id);
                    }
                });
            // show gameover if gameover condition true
            if (s.gameOver) {
                subscription.unsubscribe();
                const v = document.createElementNS(svg.namespaceURI, 'text')!;
                attr(v, {
                    x: Constants.CanvasSize / 8,
                    y: Constants.CanvasSize / 2,
                    class: 'gameover'
                });
                v.textContent = 'Game Over';
                svg.appendChild(v);
            }
            // show gamewon if gamewon condition true
            if (s.gameWon) {
                subscription.unsubscribe();
                const v = document.createElementNS(svg.namespaceURI, 'text')!;
                attr(v, {
                    x: Constants.CanvasSize / 8,
                    y: Constants.CanvasSize / 2,
                    class: 'gamewon'
                });
                v.textContent = 'Game Won!';
                svg.appendChild(v);
            }
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
    showKey('q');
    showKey('w');
  }
setTimeout(showKeys, 0)

// --------------------------------------------------------------------------------------

/**
 * vector class taken from asteroids
 */
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