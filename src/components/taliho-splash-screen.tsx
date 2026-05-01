export const TalihoSplashScreen = () => {
  return (
    <div className="absolute flex flex-col items-center justify-center z-50 top-0 left-0 bg-white w-[100vw] h-[100vh] gap-y-8 ">
      <img src="../../images/taliho-logo.png" width={"75%"} alt="" />

      <div className="relative">
        <div className="loader">
          <div className="loader-inner"></div>
        </div>
      </div>
    </div>
  );
};
