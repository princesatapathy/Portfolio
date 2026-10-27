import { Suspense, useLayoutEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  GoogleReCaptchaProvider,
  useGoogleReCaptcha,
} from "react-google-recaptcha-v3";

// components
import { Loader, Alert, PageTitle } from "../components";

import { Dog } from "../models";
import type { DogAnimation } from "../models";
import useAlert from "../hooks/useAlert";
import { SITE_NAME } from "../constants";
import {
  CONTACT_RECAPTCHA_ACTION,
  isValidContactEmail,
  isValidContactMessage,
  isValidContactName,
  type ContactFormFields,
} from "../lib/contact";

const FIELD_VALIDATORS: Record<
  keyof ContactFormFields,
  (value: string) => boolean
> = {
  name: isValidContactName,
  email: isValidContactEmail,
  message: isValidContactMessage,
};

// module-level so the Canvas gets the same object on every render
// (a new object makes react-three-fiber rebuild the camera on each hover or click)
const DOG_CAMERA = {
  position: [0, 0, 5] as [number, number, number], // Camera position in 3D space
  fov: 75, // Field of view
  near: 0.1, // Near clipping plane
  far: 1000, // Far clipping plane
};
const DOG_POSITION: [number, number, number] = [0.9, -2.7, 0]; // the ground is at the bottom
const DOG_ROTATION: [number, number, number] = [0, -0.95, 0]; // faces left, turned side-on so the wagging tail shows
const DOG_SCALE: [number, number, number] = [1.85, 1.85, 1.85];
const DOG_HIT_AREA_POSITION: [number, number, number] = [0, -0.1, 0];

type DogCanvasProps = {
  currentAnimation: DogAnimation;
};

const DogCanvas = ({ currentAnimation }: DogCanvasProps) => {
  const [isHoveringDog, setIsHoveringDog] = useState(false);
  const [isDogSitting, setIsDogSitting] = useState(true); // the dog starts out sitting

  // form activity (typing, sending) always wins. Otherwise hovering makes a seated dog wag its
  // tail and a standing dog walk. Double-click toggles sitting.
  const isFormIdle = currentAnimation === "idle";
  const animation: DogAnimation =
    !isFormIdle ? currentAnimation : isHoveringDog && !isDogSitting ? "walk" : "idle";

  return (
  <div
    className={`lg:w-1/2 w-full lg:h-auto md:h-p[550px] h-87.5 select-none ${isHoveringDog ? "cursor-pointer" : ""}`}
    title="Hover to make me wag my tail, double-click to make me stand or sit"
  >
    {/* Three.js Canvas Component */}
    <Canvas
      camera={DOG_CAMERA}
    >
      {/* Directional Light for realistic lighting */}
      <directionalLight intensity={2.5} position={[0, 0, 1]} />

      {/* soft light from above-left, so the faceted shapes have shading */}
      <directionalLight intensity={1.4} position={[-3, 5, 2]} />

      {/* Ambient Light for overall scene illumination */}
      <ambientLight intensity={0.5} />

      {/* Suspense for handling loading state */}
      <Suspense fallback={<Loader />}>
        {/* Dog Model */}
        <Dog
          currentAnimation={animation} // Current animation state
          isSitting={isDogSitting && isFormIdle}
          isWagging={isHoveringDog && isDogSitting && isFormIdle}
          position={DOG_POSITION} // Initial position in 3D space
          rotation={DOG_ROTATION} // Initial rotation
          scale={DOG_SCALE} // Initial scale
        />

        {/* invisible hit area around the dog, so hover and double-click work in every pose */}
        <mesh
          position={DOG_HIT_AREA_POSITION}
          onPointerOver={() => setIsHoveringDog(true)}
          onPointerOut={() => setIsHoveringDog(false)}
          onDoubleClick={() => setIsDogSitting((previous) => !previous)}
        >
          <boxGeometry args={[3.8, 5.2, 2.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Suspense>
    </Canvas>
  </div>
  );
};

// contact form
type ContactFormProps = {
  isRecaptchaEnabled: boolean;
};

const ContactForm = ({ isRecaptchaEnabled }: ContactFormProps) => {
  const { executeRecaptcha } = useGoogleReCaptcha();

  // refs
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const hasAttemptedSubmit = useRef(false);

  // states
  const [form, setForm] = useState<ContactFormFields>({
    name: "",
    email: "",
    message: "",
  });
  const [fieldErrors, setFieldErrors] = useState({
    name: false,
    email: false,
    message: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnimation, setCurrentAnimation] =
    useState<DogAnimation>("idle");

  // hooks
  const { alert, showAlert, hideAlert } = useAlert();

  useLayoutEffect(() => {
    const el = messageRef.current;
    if (!el) return;

    el.style.overflowY = "hidden";
    el.style.height = "auto";

    const nextHeight = el.scrollHeight;
    const maxHeight = Number.parseFloat(getComputedStyle(el).maxHeight);

    if (Number.isFinite(maxHeight) && nextHeight >= maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = "auto";
      return;
    }

    el.style.height = `${nextHeight}px`;
  }, [form.message]);

  // handle form change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const field = e.target.name as keyof ContactFormFields;
    const value = e.target.value;

    setForm((prev) => ({ ...prev, [field]: value }));

    if (!hasAttemptedSubmit.current) return;

    const isInvalid = !FIELD_VALIDATORS[field](value);
    setFieldErrors((prev) =>
      prev[field] === isInvalid ? prev : { ...prev, [field]: isInvalid },
    );
  };

  // handle form input focus
  const handleFocus = () => setCurrentAnimation("walk");

  // handle form input blur (when user enters out of form)
  const handleBlur = () => {
    if (!isLoading) {
      setCurrentAnimation("idle");
    }
  };

  const validateForm = () => {
    hasAttemptedSubmit.current = true;

    const nextErrors = {
      name: !isValidContactName(form.name),
      email: !isValidContactEmail(form.email),
      message: !isValidContactMessage(form.message),
    };

    setFieldErrors(nextErrors);

    return !nextErrors.name && !nextErrors.email && !nextErrors.message;
  };

  const resetIdleAfterDelay = () => {
    setTimeout(() => {
      setCurrentAnimation("idle");
      hideAlert();
    }, 3000);
  };

  // handle form submit
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    // prevent page reload
    e.preventDefault();

    if (!validateForm()) return;

    if (isRecaptchaEnabled && !executeRecaptcha) {
      showAlert({
        show: true,
        text: "reCAPTCHA is not ready. Please try again.",
        type: "danger",
      });
      return;
    }

    // show loader
    setIsLoading(true);

    // show dog hit animation
    setCurrentAnimation("hit");

    try {
      const recaptchaToken =
        isRecaptchaEnabled && executeRecaptcha
          ? await executeRecaptcha(CONTACT_RECAPTCHA_ACTION)
          : "";

      // honeypot: stays empty for real visitors
      const honeypotValue = formRef.current
        ? String(new FormData(formRef.current).get("website") ?? "")
        : "";

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          message: form.message,
          recaptchaToken,
          website: honeypotValue,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        showAlert({
          show: true,
          text: data?.error ?? "I didn't receive your message",
          type: "danger",
        });
        return;
      }

      // show success message
      showAlert({
        show: true,
        text: "Message sent successfully!",
        type: "success",
      });
      setForm({ name: "", email: "", message: "" });
      setFieldErrors({
        name: false,
        email: false,
        message: false,
      });
    } catch (error: unknown) {
      console.log("Contact_email: ", error);
      showAlert({
        show: true,
        text: "I didn't receive your message",
        type: "danger",
      });
    } finally {
      resetIdleAfterDelay();
      setIsLoading(false);
    }
  };

  return (
    <section className="relative flex lg:flex-row flex-col max-w-5xl mx-auto sm:px-16 px-8 pt-24 pb-6 lg:h-screen">
      {/* show alert on form submit */}
      {alert.show && <Alert {...alert} />}

      {/* get in touch */}
      <div className="flex-1 min-w-[50%] flex flex-col">
        {/* head text */}
        <h1 className="head-text">Get in Touch</h1>

        {/* contact form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="w-full flex flex-col gap-4 mt-6"
        >
          {/* honeypot: hidden from people, bots fill it in */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          {/* name */}
          <label className="text-black-500 dusk:text-slate-200 font-semibold" htmlFor="name">
            Name
            <input
              type="text"
              id="name"
              name="name"
              className="input disabled:cursor-not-allowed"
              placeholder="John Doe"
              title="Name"
              value={form.name}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              maxLength={200}
              disabled={isLoading}
              aria-invalid={fieldErrors.name}
              aria-describedby="name-error"
            />
            <span
              className={`text-red-500 text-sm font-normal mt-2 ${
                fieldErrors.name ? "block" : "hidden"
              }`}
              id="name-error"
            >
              Invalid Name
            </span>
          </label>

          {/* email */}
          <label className="text-black-500 dusk:text-slate-200 font-semibold" htmlFor="email">
            E-mail
            <input
              type="email"
              id="email"
              name="email"
              className="input disabled:cursor-not-allowed"
              placeholder="johndoe@email.com"
              value={form.email}
              title="Email"
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              maxLength={100}
              disabled={isLoading}
              aria-invalid={fieldErrors.email}
              aria-describedby="email-error"
            />
            <span
              className={`text-red-500 text-sm font-normal mt-2 ${
                fieldErrors.email ? "block" : "hidden"
              }`}
              id="email-error"
            >
              Invalid E-mail
            </span>
          </label>

          {/* message */}
          <label className="text-black-500 dusk:text-slate-200 font-semibold" htmlFor="message">
            Your Message
            <textarea
              ref={messageRef}
              id="message"
              name="message"
              className="textarea disabled:cursor-not-allowed"
              rows={3}
              placeholder="Let me know how I can help you!"
              value={form.message}
              title="Message"
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              maxLength={500}
              disabled={isLoading}
              aria-invalid={fieldErrors.message}
              aria-describedby="message-error"
            />
            <span
              className={`text-red-500 text-sm font-normal mt-2 ${
                fieldErrors.message ? "block" : "hidden"
              }`}
              id="message-error"
            >
              Invalid Message
            </span>
          </label>

          {/* form submit btn */}
          <button
            type="submit"
            disabled={isLoading}
            title={isLoading ? "Sending..." : "Send Message"}
            className="btn"
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            {isLoading ? "Sending..." : "Send Message"}
          </button>
          {isRecaptchaEnabled && (
            <p className="mt-3 text-xs text-black-500/60 dusk:text-slate-400">
              This site is protected by reCAPTCHA.
            </p>
          )}
        </form>
      </div>

      <DogCanvas currentAnimation={currentAnimation} />
    </section>
  );
};

// contact
const Contact = () => {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  return (
    <>
      {/* update site title */}
      <PageTitle title={`${SITE_NAME} | Contact Me`} />

      {/* reCAPTCHA is optional: without a site key the form still works */}
      {siteKey ? (
        <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
          <ContactForm isRecaptchaEnabled />
        </GoogleReCaptchaProvider>
      ) : (
        <ContactForm isRecaptchaEnabled={false} />
      )}
    </>
  );
};

export default Contact;
