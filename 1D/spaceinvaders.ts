import { fromEvent,interval, merge } from 'rxjs'; 
import { map, filter, scan} from 'rxjs/operators';

type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'f' | 'r'
type Event = 'keydown' | 'keyup'

function spaceinvaders() {

    // game constants
    const
        Constants = {
            CanvasSize:600,
            BulletRadius: 7, BulletVelocity: 3,
            AlienBulletVelocity: 1.5, AlienBulletDirection: 180,
            AlienVelocity: 1,
            PlayerVelocity: 3,
            PlayerX: 10, PlayerY:10,
            ShieldX:100, ShieldY:5,
            AlienX: 25, AlienY: 25,
            StartAlienAmount: 30,
            AlienScoreMultiplier: 5,
            GrazeDistance: 20
        } as const

    // the game has these entity types:
    type ViewType = 'player' | 'bullet' | 'alien' | 'alienbullet' | 'shields'

    // game has these game state changes
    class Tick { constructor(){} }
    class Translate { constructor(public readonly magnitude:number) {} }
    class Shoot { constructor() {} }
    class Reset { constructor() {} }

    // define game clock
    const gameClock = interval(10)
  
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
    shoot = keyObservable('keydown','f', ()=>new Shoot()),
    reset = keyObservable('keydown', 'r', ()=>new Reset())

// --------------------------------------------------------------------------------------
// defining templates for entities and state

    // define entity interface
    interface IEntity {
        ViewType: ViewType,     // type of entity
        id: string,             // id of entity (based on total state object count)
        size: Vec,         // radius of entity (everything is a circle)
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
        player: Entity,                       // the sole player / player in the game
        shields: ReadonlyArray<Entity>     // players shields
        bullets: ReadonlyArray<Entity>,     // bullet objects array
        alienBullets: ReadonlyArray<Entity> // alienbullet objects array
        aliens: ReadonlyArray<Entity>,      // aliens array
        garbage: ReadonlyArray<Entity>,     // garbage objects array, things that need to be removed from screen in updateview
        objCount: number,                   // object count 
        score: ReadonlyArray<number>,                      // score amount
        garbageClean: boolean,              // boolean value to see if garbage needs cleaning (true when reset pressed)
        gameOver: boolean,
        gameWon: boolean
    }>

// --------------------------------------------------------------------------------------
// functions to create state and entities 

    // curried func to make entities with varying arguments
    const createEntity = (viewType: ViewType) => (id: string) => (size: Vec) => (pos: Vec) => (vel: Vec) => (timeCreated: number) => <Entity>{
        ViewType: viewType,
        id: id,
        size: size,
        pos: pos,
        vel: vel,
        add: Vec.Zero,
        acc: Vec.Zero,
        createTime: timeCreated
    },

    createAlien = createEntity('alien'),
    createBullet = createEntity('bullet'),
    createAlienBullet = createEntity('alienbullet'),
    createPlayer = createEntity('player'),
    createShield = createEntity('shields')

    const
        // create initial state and entities
        initialState:State = {
            time: 0,
            player: createPlayer('player')(new Vec(Constants.PlayerX, Constants.PlayerY))(new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.8))(Vec.Zero)(0),
            shields: [].concat(
                [...Array(3)].map((_,i) => createShield(String(i))(new Vec(Constants.ShieldX, Constants.ShieldY))(new Vec(i*200+100, Constants.CanvasSize*0.7))(Vec.Zero)(0)),
                [...Array(3)].map((_,i) => createShield(String(i+3))(new Vec(Constants.ShieldX, Constants.ShieldY))(new Vec(i*200+100, Constants.CanvasSize*0.7+5))(Vec.Zero)(0)),
                [...Array(3)].map((_,i) => createShield(String(i+6))(new Vec(Constants.ShieldX, Constants.ShieldY))(new Vec(i*200+100, Constants.CanvasSize*0.7+10))(Vec.Zero)(0)),
                [...Array(3)].map((_,i) => createShield(String(i+9))(new Vec(Constants.ShieldX, Constants.ShieldY))(new Vec(i*200+100, Constants.CanvasSize*0.7+15))(Vec.Zero)(0)),
                [...Array(3)].map((_,i) => createShield(String(i+12))(new Vec(Constants.ShieldX, Constants.ShieldY))(new Vec(i*200+100, Constants.CanvasSize*0.7+20))(Vec.Zero)(0))
                ),
            bullets: [],
            alienBullets: [],
            aliens: [].concat(
                [...Array(7)].map((_,i) => createAlien(String(i+15))(new Vec(Constants.AlienX, Constants.AlienY))(new Vec((i*100)+50, 20))(Vec.Zero)(0)), // create an array of aliens on level choose
                [...Array(7)].map((_,i) => createAlien(String(i+22))(new Vec(Constants.AlienX, Constants.AlienY))(new Vec((i*100)+50, 70))(Vec.Zero)(0)),
                [...Array(7)].map((_,i) => createAlien(String(i+39))(new Vec(Constants.AlienX, Constants.AlienY))(new Vec((i*100)+50, 120))(Vec.Zero)(0)),
                [...Array(7)].map((_,i) => createAlien(String(i+46))(new Vec(Constants.AlienX, Constants.AlienY))(new Vec((i*100)+50, 170))(Vec.Zero)(0)),
                [...Array(7)].map((_,i) => createAlien(String(i+53))(new Vec(Constants.AlienX, Constants.AlienY))(new Vec((i*100)+50, 220))(Vec.Zero)(0))
            ),
            garbage: [],
            objCount: 100,
            score: [0,0],
            garbageClean: false,
            gameOver: false,
            gameWon: false
        },

// --------------------------------------------------------------------------------------
// functions to manipulate state and entities

        // interval tick which calls state and entity manipulators
        tick = (s:State) => {

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
                add: Vec.unitVecInDirection(90).scale(s.time/1000),
                pos: s.time % 300 === 0 ? torusWrap(o.pos.add(o.vel)).add(Vec.unitVecInDirection(0).scale(-20)): torusWrap(o.pos.add(o.vel)),
                vel: o.add
            }

            // movement of alien bullet has different direction
            const moveAlienBullet = (o: Entity) => <Entity>{
                ...o,
                pos:o.pos.add(o.vel),
            }

            // movement of player go through here 
            const playerMovement = (o: Entity) => <Entity> {
                ...o,
                pos: torusWrap(o.pos.add(o.vel)),
                vel: o.add
            }

             // movement of shields go through here - for custom movement
             const shieldsMovement = (o: Entity) => <Entity> {
                ...o,
                pos: torusWrap(o.pos.add(o.vel)),
                vel: o.add.add(Vec.unitVecInDirection(90).scale(0))    // shield rotation based on time interval as angle, then vector manipulate as appropriate
            }

            // movement of bullet needs to have a constant velocity, so needs different physics. 
            const moveBullet = (o:Entity) => <Entity>{
                ...o,
                pos:torusWrapX(o.pos.add(o.vel)),
                vel:Vec.unitVecInDirection(0).scale(Constants.BulletVelocity)
            }

            // deletion of entities that are out of y bounds, split into active and binned. active uses not which comes from asteroids
            const outOfBounds = (o: Entity) => o.pos.y >= Constants.CanvasSize || o.pos.y <= 0,
            binnedBullets: Entity[] = s.bullets.filter(outOfBounds),
            activeBullets = s.bullets.filter(not(outOfBounds)),
            binnedAlienBullets: Entity[] = s.alienBullets.filter(outOfBounds),
            activeAlienBullets = s.alienBullets.filter(not(outOfBounds))

            // function to handle collisions that returns state
            const handleCollisions = (s:State) => {
                const entitiesCollided = ([a,b]: [Entity,Entity]) => a.pos.sub(b.pos).len() < (a.size.add(b.size).len())/2,      // check if the positions of both entities are in the region of their squares

                playerAlienCollision = s.aliens.filter(r => entitiesCollided([s.player, r])).length > 0,                    // boolean from seeing if there are any collisions with the player
                playerAlienBulletCollision = s.alienBullets.filter(r => entitiesCollided([s.player, r])).length > 0,

                allShieldsandAliens = flatMap(s.shields, b => s.aliens.map<[Entity, Entity]>(r => [b, r])),                 // flaten shields and aliens
                collidedShieldsAndAliens = allShieldsandAliens.filter(entitiesCollided),                                    // filter for collided aliens and shields
                
                allShieldsAndAlienBullets = flatMap(s.shields, b => s.alienBullets.map<[Entity, Entity]>(r => [b, r])),     // flatten for alien bullets and shields
                collidedShieldsAndAlienBullets = allShieldsAndAlienBullets.filter(entitiesCollided),                        // filter for collided alien bullets and shields
 
                allBulletsAndAliens = flatMap(s.bullets, b => s.aliens.map<[Entity, Entity]>(r => [b, r])),                 // flatten bullets and aliens 
                collidedBulletsAndAliens = allBulletsAndAliens.filter(entitiesCollided),                                    // filter for collided bullets and aliens

                allBulletsAndShields = flatMap(s.bullets, b => s.shields.map<[Entity, Entity]>(r => [b, r])),                // flatten bullets and shields
                collidedBulletsAndShields = allBulletsAndShields.filter(entitiesCollided),                                  // filter for collided bullets and shields

                collidedBullets = [].concat(collidedBulletsAndAliens.map(([bullet, _]) => bullet), collidedBulletsAndShields.map(([bullet, _]) => bullet)),   // array of bullets that have collided with aliens and shields
                collidedAliens = [].concat(collidedBulletsAndAliens.map(([_, aliens]) => aliens), collidedShieldsAndAliens.map(([_, aliens]) => aliens)),    // array of aliens that have collided with player bullets
                collidedShields = [].concat(collidedShieldsAndAlienBullets.map(([shields, _]) => shields), collidedShieldsAndAliens.map(([shields, _]) => shields)),                            // array of shields that have collided with alien bullets
                collidedAlienBullets = collidedShieldsAndAlienBullets.map(([_, alienBullets]) => alienBullets)               // array of shields that have collided with alien bullets

                const entitiesGrazed = ([a,b]: [Entity, Entity]) => a.pos.sub(b.pos).len() < (a.size.add(a.size).len())/2 + Constants.GrazeDistance,         // condition for adding graze points
                playerAlienBulletGraze = s.alienBullets.filter(r => entitiesGrazed([s.player, r])),                                             // array of alienbullets grazed by the player

                win = s.aliens.length === 0,                                                 // condition for winning game
                cut = except((a: Entity) => (b: Entity) => a.id === b.id)                                                   // function for cutting out entities from one list by another's

                return <State> {...s,
                    bullets: cut(s.bullets)(collidedBullets),   // remove bullets that have collided
                    aliens: cut(s.aliens)(collidedAliens),      // remove aliens that have collided
                    alienBullets: cut(s.alienBullets)(collidedAlienBullets),  // remove alienbullets that have collided
                    shields: cut(s.shields)(collidedShields),       // remove shields that have collded
                    garbage: s.garbage.concat(collidedBullets, collidedAliens, collidedShields, collidedAlienBullets),   // put all collided things in the garbage for updateview to despawn
                    score: s.score.map((x, i) => x + [playerAlienBulletGraze.length, collidedAliens.length*Constants.AlienScoreMultiplier][i]),   // calculate the score from aliens collided and graze score
                    gameOver: playerAlienCollision || playerAlienBulletCollision,   // conditions to lose
                    gameWon: win    // conditions to win
                };
            }

            // one of the most scuffed map callback functions i have ever written - converts every alien into an alienbullet just so i can spawn an alien bullet with position relative to the alien every half a second
            const createAlienBullets = (s:State) => {
                return <State> {...s,
                    alienBullets: s.time % 500 === 0 ? s.alienBullets.concat(s.aliens.map((x,i) => i >= s.aliens.length-5 ? 
                    createAlienBullet
                        (String(s.time+Number(x.id)+s.objCount))
                        (new Vec(Constants.BulletRadius, Constants.BulletRadius))
                        (x.pos.add(Vec.unitVecInDirection(0).scale(-20)))
                        (Vec.unitVecInDirection(0).scale(-2))
                        (s.time)
                        : x, )
                        ): s.alienBullets,
                    objCount: s.time % 500 === 0 ? s.time+s.objCount+100 : s.objCount
                }
            }

            // bring everything together
            return s.garbageClean ? initialState:
            handleCollisions(createAlienBullets({...s,
                player: playerMovement(s.player),
                shields: s.shields.map(shieldsMovement),
                bullets: activeBullets.map(moveBullet),
                aliens: s.aliens.map(alienMovement),
                alienBullets: activeAlienBullets.filter(x => x.ViewType === 'alienbullet').map(moveAlienBullet),
                time: s.time + 1,
                garbage: s.garbage.concat(binnedBullets, binnedAlienBullets)
            }))
        },

// --------------------------------------------------------------------------------------    
// final state reducers

        // reducing states
        reduceState = (s:State, e:Shoot|Translate|Tick|Reset)=>
            e instanceof Translate ? {...s, 
                player: {...s.player, 
                    add: Vec.unitVecInDirection(90).scale(e.magnitude)  // puts a magnitude into add to add onto velocity vector later in playerMovement
                }
            }:
            e instanceof Shoot ? {...s,
                bullets: s.bullets.concat([
                    ((unitVec:Vec) => 
                        createBullet                                    //create new bullet on space press
                        (String(s.objCount))                            //bullet id
                        (new Vec(Constants.BulletRadius, Constants.BulletRadius))                        //bullet rad
                        (s.player.pos.add(unitVec.scale(25)))           //bullet pos
                        (Vec.Zero)
                        (s.time))                                       //bullet time created
                        (Vec.unitVecInDirection(0))]),                  //bullet direction vector
                objCount: s.objCount + 1 
            }:
            e instanceof Reset ? {...s,
                garbage: s.garbage.concat(s.alienBullets, s.aliens, s.bullets),
                alienBullets: [],
                aliens: [],
                bullets: [],
                garbageClean: true,
                gameOver: false,
                gameWon: false
            }:
            s.gameOver ? {...s,}:
            s.gameWon ? {...s}:
            tick(s)
             // passes Tick time to tick function if not instance of anything else
        
        // main game stream. merge all events and subscribe to updater
        const subscription = 
            merge(gameClock, startLeftTranslate,startRightTranslate,stopLeftTranslate, 
                stopRightTranslate, shoot, reset)  
                .pipe(scan(reduceState, initialState)).subscribe(updateView)

// --------------------------------------------------------------------------------------
// update view
        
        // view updater function - only part of the code that isnt pure, mostly taken from asteroids
        function updateView(s: State) {
            document.getElementById('score').innerHTML = String(s.score.reduce((x,y)=>x+y)); //display totalscore on html
            document.getElementById('graze').innerHTML = String(s.score[0]); //display grazescore on html
            const  
                player = document.getElementById("player")!,
                svg = document.getElementById("svgCanvas")!,

                updateEntityView = (b: Entity) => { // taken from asteroids as a way to generate entity objects for HTML
                    function createEntityView() {
                        const v = document.createElementNS(svg.namespaceURI, "rect")!;
                        attr(v, {id:b.id, width: b.size.x, height:b.size.y, transform: "translate(" + String(-b.size.x/2) + ")"});
                        v.classList.add(b.ViewType)
                        svg.appendChild(v);
                        return v;
                    }
                    const v = document.getElementById(b.id) || createEntityView();
                    attr(v, {x:b.pos.x, y:b.pos.y})
                };

            attr(player, {transform: `translate(${s.player.pos.x},${s.player.pos.y})`});
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
                console.log(s.gameOver, s.time)
            // show gameover if gameover condition true
            if (s.gameOver) {
                // updateView(initialState);
                document.getElementById('player').style.display="none";
                const v = document.createElementNS(svg.namespaceURI, 'text')!;
                attr(v, {
                    x: Constants.CanvasSize / 8,
                    y: Constants.CanvasSize / 2,
                    class: 'gameover'
                });
                v.textContent = 'Game Over';
                svg.appendChild(v);

            }
            if (!s.gameOver) {
                try {
                    const v = Array.from(document.getElementsByClassName('gameover') as HTMLCollectionOf<HTMLElement>)
                    v.forEach(x => x.style.display="none")
                } catch (e) {
                    console.log("NOT YET!!")
                }
                document.getElementById('player').style.display="block"
            }
            // show gamewon if gamewon condition true
            if (s.gameWon) {
                // updateView(initialState);
                const v = document.createElementNS(svg.namespaceURI, 'text')!;
                attr(v, {
                    x: Constants.CanvasSize / 8,
                    y: Constants.CanvasSize / 2,
                    class: 'gamewon'
                });
                v.textContent = 'Game Won!';
                svg.appendChild(v);
            }
            if (!s.gameWon) {
                try {
                    const v = Array.from(document.getElementsByClassName('gamewon') as HTMLCollectionOf<HTMLElement>)
                    v.forEach(x => x.style.display="none")
                } catch (e) {
                    console.log("NOT YET!!")
                }
                document.getElementById('player').style.display="block"
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
    showKey('f');

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